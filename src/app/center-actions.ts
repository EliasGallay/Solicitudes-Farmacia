'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../lib/feedback'
import { requireRole } from '../lib/session'

// Mismo límite que health_centers_name_length en la base.
const CENTER_NAME_MAX = 80

const centerNameSchema = z.string().trim().min(1).max(CENTER_NAME_MAX)
const centerIdSchema = z.string().uuid()

// 23505: ya existe un centro con ese nombre (sin distinguir mayúsculas).
function centerErrorCode(error: { code?: string }) {
  return error.code === '23505' ? 'centro-duplicado' : 'centro-error'
}

// Los centros se usan en filtros, formularios y colores de varias pantallas.
function revalidateCenters() {
  revalidatePath('/', 'layout')
}

const CENTERS_PAGE = '/centros'

// Un centro no se borra, se desactiva. Ante un error se vuelve con el formulario abierto:
// el de alta (?nuevo=1) o el de renombrar (?editar=).
export async function createCenter(formData: FormData) {
  const name = centerNameSchema.safeParse(formData.get('name'))
  if (!name.success) redirect(withFeedback(`${CENTERS_PAGE}?nuevo=1`, 'error', 'centro-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('health_centers').insert({ name: name.data })
  if (error) redirect(withFeedback(`${CENTERS_PAGE}?nuevo=1`, 'error', centerErrorCode(error)))
  revalidateCenters()
  redirect(withFeedback(CENTERS_PAGE, 'success', 'centro-creado'))
}

export async function updateCenter(formData: FormData) {
  const id = centerIdSchema.safeParse(formData.get('id'))
  if (!id.success) redirect(withFeedback(CENTERS_PAGE, 'error', 'centro-invalido'))
  const editPage = `${CENTERS_PAGE}?editar=${id.data}`
  const name = centerNameSchema.safeParse(formData.get('name'))
  if (!name.success) redirect(withFeedback(editPage, 'error', 'centro-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('health_centers').update({ name: name.data }).eq('id', id.data)
  if (error) redirect(withFeedback(editPage, 'error', centerErrorCode(error)))
  revalidateCenters()
  redirect(withFeedback(CENTERS_PAGE, 'success', 'centro-actualizado'))
}

export async function toggleCenter(formData: FormData) {
  const id = centerIdSchema.safeParse(formData.get('id'))
  const active = formData.get('active') === 'true'
  if (!id.success) redirect(withFeedback(CENTERS_PAGE, 'error', 'centro-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.from('health_centers').update({ active: !active }).eq('id', id.data)
  if (error) redirect(withFeedback(CENTERS_PAGE, 'error', centerErrorCode(error)))
  revalidateCenters()
  redirect(withFeedback(CENTERS_PAGE, 'success', active ? 'centro-desactivado' : 'centro-reactivado'))
}
