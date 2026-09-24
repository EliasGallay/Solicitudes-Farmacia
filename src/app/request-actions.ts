'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { OBSERVATIONS_MAX_LENGTH } from '../lib/requests'
import { createSupabaseServerClient } from '../lib/supabase/server'

const itemsSchema = z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() })).min(1)
const observationsSchema = z.string().trim().max(OBSERVATIONS_MAX_LENGTH).optional()
const healthCenterSchema = z.string().uuid()

// Paso 2 de /solicitudes/nueva: persiste solo al confirmar.
// Farmacéutica: el centro es siempre el de su perfil. Admin: el centro elegido en el wizard.
// La RPC vuelve a aplicar esta misma regla en la base.
export async function submitRequest(items: { product_id: string; quantity: number }[], observations?: string, healthCenterId?: string): Promise<{ error: string }> {
  const parsed = itemsSchema.safeParse(items)
  if (!parsed.success) return { error: 'Revisá los productos y las cantidades seleccionadas.' }
  const parsedObservations = observationsSchema.safeParse(observations)
  if (!parsedObservations.success) return { error: `La observación puede tener hasta ${OBSERVATIONS_MAX_LENGTH} caracteres.` }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, health_center_id').eq('user_id', user.id).maybeSingle()
  let centerId = profile?.health_center_id ?? null
  if (profile?.role === 'admin') {
    const parsedCenter = healthCenterSchema.safeParse(healthCenterId)
    if (!parsedCenter.success) return { error: 'Seleccioná el centro de salud de la solicitud.' }
    centerId = parsedCenter.data
  }

  const { data: requestId, error } = await supabase.rpc('create_request_with_items', {
    requested_health_center_id: centerId,
    requested_items: parsed.data,
    requested_observations: parsedObservations.data || null,
  })

  if (error || !requestId) return { error: 'No se pudo enviar la solicitud. Intentá nuevamente.' }
  revalidatePath('/')
  revalidatePath('/solicitudes')
  redirect(`/solicitudes/nueva?enviada=${requestId}`)
}
