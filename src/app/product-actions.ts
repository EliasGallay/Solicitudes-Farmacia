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
  if (!parsed.success) redirect(withFeedback('/catalogos/nuevo', 'error', 'producto-incompleto'))

  const { supabase } = await requireRole('admin')
  const { data, error } = await supabase.from('products').insert({ ...parsed.data, is_test_data: false }).select('id').single()
  if (error) redirect(withFeedback('/catalogos/nuevo', 'error', productErrorCode(error)))
  revalidatePath('/catalogos')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback(`/catalogos/${data.id}`, 'success', 'producto-creado'))
}

export async function updateProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const product = productSchema.safeParse({ area: formData.get('area'), name: formData.get('name'), presentation: formData.get('presentation'), product_type: formData.get('product_type') })
  if (!id.success) redirect(withFeedback('/catalogos', 'error', 'producto-invalido'))
  const page = `/catalogos/${id.data}`
  if (!product.success) redirect(withFeedback(page, 'error', 'producto-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('products').update(product.data).eq('id', id.data)
  if (error) redirect(withFeedback(page, 'error', productErrorCode(error)))
  revalidatePath('/catalogos', 'layout')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback(page, 'success', 'producto-actualizado'))
}

export async function toggleProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const active = formData.get('active') === 'true'
  if (!id.success) redirect(withFeedback('/catalogos', 'error', 'producto-invalido'))
  const page = `/catalogos/${id.data}`

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('products').update({ active: !active }).eq('id', id.data)
  if (error) redirect(withFeedback(page, 'error', productErrorCode(error)))
  revalidatePath('/catalogos', 'layout')
  revalidatePath('/solicitudes/nueva')
  redirect(withFeedback(page, 'success', active ? 'producto-desactivado' : 'producto-reactivado'))
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

const TYPES_PAGE = '/catalogos/tipos'

// Ante un error se vuelve con el formulario abierto: el de alta (?nuevo=1) o el de renombrar (?editar=).
export async function createProductType(formData: FormData) {
  const label = String(formData.get('label') ?? '')
  const parsed = productTypeSchema.safeParse({ area: formData.get('area'), key: productTypeKey(label), label })
  if (!parsed.success) redirect(withFeedback(`${TYPES_PAGE}?nuevo=1`, 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('product_types').insert(parsed.data)
  if (error) redirect(withFeedback(`${TYPES_PAGE}?nuevo=1`, 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback(TYPES_PAGE, 'success', 'tipo-creado'))
}

export async function updateProductType(formData: FormData) {
  const ref = productTypeRefSchema.safeParse({ area: formData.get('area'), key: formData.get('key') })
  if (!ref.success) redirect(withFeedback(TYPES_PAGE, 'error', 'tipo-invalido'))
  const editPage = `${TYPES_PAGE}?editar=${ref.data.area}.${ref.data.key}`
  const parsed = productTypeSchema.safeParse({ ...ref.data, label: formData.get('label') })
  if (!parsed.success) redirect(withFeedback(editPage, 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { area, key, label } = parsed.data
  const { error } = await supabase.from('product_types').update({ label }).eq('area', area).eq('key', key)
  if (error) redirect(withFeedback(editPage, 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback(TYPES_PAGE, 'success', 'tipo-actualizado'))
}

export async function toggleProductType(formData: FormData) {
  const parsed = productTypeRefSchema.safeParse({ area: formData.get('area'), key: formData.get('key') })
  const active = formData.get('active') === 'true'
  if (!parsed.success) redirect(withFeedback(TYPES_PAGE, 'error', 'tipo-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('product_types').update({ active: !active }).eq('area', parsed.data.area).eq('key', parsed.data.key)
  if (error) redirect(withFeedback(TYPES_PAGE, 'error', productTypeErrorCode(error)))
  revalidateProductTypes()
  redirect(withFeedback(TYPES_PAGE, 'success', active ? 'tipo-desactivado' : 'tipo-reactivado'))
}
