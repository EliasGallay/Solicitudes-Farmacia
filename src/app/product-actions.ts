'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { keySchema } from '../lib/filters'
import { withFeedback } from '../lib/feedback'
import { productTypeKey } from '../lib/product-types'
import { requireRole } from '../lib/session'

// 23505: violación de unicidad (rubro + nombre + presentación ya existentes).
// 23503: el tipo no existe en el rubro del producto (FK compuesta con product_types).
function productErrorCode(error: { code?: string }) {
  if (error.code === '23505') return 'producto-duplicado'
  return error.code === '23503' ? 'producto-invalido' : 'producto-error'
}

const productSchema = z.object({
  area: keySchema,
  name: z.string().trim().min(1).max(150),
  presentation: z.string().trim().min(1).max(150),
  product_type: keySchema,
})

const idSchema = z.string().uuid()

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse({ area: formData.get('area'), name: formData.get('name'), presentation: formData.get('presentation'), product_type: formData.get('product_type') })
  if (!parsed.success) redirect(withFeedback('/catalogos', 'error', 'producto-incompleto'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('products').insert({ ...parsed.data, is_test_data: false })
  if (error) redirect(withFeedback('/catalogos', 'error', productErrorCode(error)))
  revalidatePath('/catalogos')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback('/catalogos', 'success', 'producto-creado'))
}

export async function updateProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const product = productSchema.safeParse({ area: formData.get('area'), name: formData.get('name'), presentation: formData.get('presentation'), product_type: formData.get('product_type') })
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

// Tipos de producto por rubro. La clave se deriva del nombre al crearlo y no cambia después:
// los productos la referencian (FK compuesta). Un tipo no se borra, se desactiva.
const productTypeSchema = z.object({ area: keySchema, key: keySchema, label: z.string().trim().min(1).max(60) })
const productTypeRefSchema = z.object({ area: keySchema, key: keySchema })

function productTypeErrorCode(error: { code?: string }) {
  return error.code === '23505' ? 'tipo-duplicado' : 'tipo-error'
}

// Los tipos se usan en filtros y formularios de varias pantallas.
function revalidateProductTypes() {
  revalidatePath('/', 'layout')
}

export async function createProductType(formData: FormData) {
  const label = String(formData.get('label') ?? '')
  const parsed = productTypeSchema.safeParse({ area: formData.get('area'), key: productTypeKey(label), label })
  if (!parsed.success) redirect(withFeedback('/catalogos', 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('product_types').insert(parsed.data)
  if (error) redirect(withFeedback('/catalogos', 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback('/catalogos', 'success', 'tipo-creado'))
}

export async function updateProductType(formData: FormData) {
  const parsed = productTypeSchema.safeParse({ area: formData.get('area'), key: formData.get('key'), label: formData.get('label') })
  if (!parsed.success) redirect(withFeedback('/catalogos', 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { area, key, label } = parsed.data
  const { error } = await supabase.from('product_types').update({ label }).eq('area', area).eq('key', key)
  if (error) redirect(withFeedback('/catalogos', 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback('/catalogos', 'success', 'tipo-actualizado'))
}

export async function toggleProductType(formData: FormData) {
  const parsed = productTypeRefSchema.safeParse({ area: formData.get('area'), key: formData.get('key') })
  const active = formData.get('active') === 'true'
  if (!parsed.success) redirect(withFeedback('/catalogos', 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('product_types').update({ active: !active }).eq('area', parsed.data.area).eq('key', parsed.data.key)
  if (error) redirect(withFeedback('/catalogos', 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback('/catalogos', 'success', active ? 'tipo-desactivado' : 'tipo-reactivado'))
}
