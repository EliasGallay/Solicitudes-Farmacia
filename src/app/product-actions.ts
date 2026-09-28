'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { productTypeSchema } from '../lib/product-types'
import { withFeedback } from '../lib/feedback'
import { requireRole } from '../lib/session'

// 23505: violación de unicidad (nombre + presentación ya existentes).
function productErrorCode(error: { code?: string }) {
  return error.code === '23505' ? 'producto-duplicado' : 'producto-error'
}

const productSchema = z.object({
  name: z.string().trim().min(1).max(150),
  presentation: z.string().trim().min(1).max(150),
  product_type: productTypeSchema,
})

const idSchema = z.string().uuid()

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse({ name: formData.get('name'), presentation: formData.get('presentation'), product_type: formData.get('product_type') })
  if (!parsed.success) redirect(withFeedback('/catalogos', 'error', 'producto-incompleto'))

  const { supabase } = await requireRole('admin')
  // Único rubro hasta la fase 4 (docs/plans/plan-rubros.md), cuando el formulario elige el rubro.
  const { error } = await supabase.from('products').insert({ ...parsed.data, area: 'pharmacy', is_test_data: false })
  if (error) redirect(withFeedback('/catalogos', 'error', productErrorCode(error)))
  revalidatePath('/catalogos')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback('/catalogos', 'success', 'producto-creado'))
}

export async function updateProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const product = productSchema.safeParse({ name: formData.get('name'), presentation: formData.get('presentation'), product_type: formData.get('product_type') })
  if (!id.success || !product.success) redirect(withFeedback('/catalogos', 'error', 'producto-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('products').update(product.data).eq('id', id.data)
  if (error) redirect(withFeedback('/catalogos', 'error', productErrorCode(error)))
  revalidatePath('/catalogos')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback('/catalogos', 'success', 'producto-actualizado'))
}

export async function toggleProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const active = formData.get('active') === 'true'
  if (!id.success) redirect(withFeedback('/catalogos', 'error', 'producto-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('products').update({ active: !active }).eq('id', id.data)
  if (error) redirect(withFeedback('/catalogos', 'error', productErrorCode(error)))
  revalidatePath('/catalogos')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback('/catalogos', 'success', active ? 'producto-desactivado' : 'producto-reactivado'))
}
