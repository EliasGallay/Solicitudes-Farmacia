'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '../lib/supabase/server'

const requestSchema = z.object({
  healthCenterId: z.string().uuid(),
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
})

export async function createRequest(formData: FormData) {
  const items = Array.from(formData.entries())
    .filter(([key]) => key.startsWith('quantity_'))
    .map(([key, value]) => ({ product_id: key.replace('quantity_', ''), quantity: Number(value) }))
    .filter((item) => item.quantity > 0)

  const parsed = requestSchema.safeParse({ healthCenterId: formData.get('health_center_id'), items })
  if (!parsed.success) redirect('/nueva-solicitud?error=Completá+al+menos+un+producto+con+cantidad')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('create_request_with_items', {
    requested_health_center_id: parsed.data.healthCenterId,
    requested_items: parsed.data.items,
  })

  if (error) redirect(`/nueva-solicitud?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/')
  revalidatePath('/nueva-solicitud')
  revalidatePath('/solicitudes')
  redirect('/nueva-solicitud?success=Solicitud+creada')
}
