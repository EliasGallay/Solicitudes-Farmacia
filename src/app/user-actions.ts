'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../lib/feedback'
import { requireRole } from '../lib/session'
import { createSupabaseAdminClient } from '../lib/supabase/admin'
import { newUserSchema, passwordSchema, userSchema, type NewUserValues, type UserValues } from '../lib/users'

// Gestión de usuarios (/usuarios). Reparto de responsabilidades:
// - perfil, rol, centro y rubros: RPCs admin_* con el cliente de la sesión (la base valida que
//   quien llama sea admin y que no se quite el acceso a sí mismo);
// - cuenta de Auth (alta, email, contraseña, bloqueo, borrado): cliente admin, solo acá.

const idSchema = z.string().uuid()

// Bloqueo de la cuenta en Auth para un usuario desactivado (~100 años): no puede iniciar sesión
// ni renovar la sesión abierta.
const BANNED = '876000h'

// Errores de las RPCs admin_* con mensaje propio para el admin (ver 202609300001_user_admin.sql).
const RPC_MESSAGE_CODES = new Set(['42501', '23514', '23503', 'P0002'])

function rpcErrorMessage(error: { code?: string; message: string }) {
  return error.code && RPC_MESSAGE_CODES.has(error.code) ? `${error.message}.` : 'No se pudieron guardar los datos del usuario. Intentá nuevamente.'
}

function authErrorMessage(error: { code?: string }) {
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return 'Ya existe una cuenta con ese email.'
  if (error.code === 'weak_password') return 'La contraseña es demasiado débil. Probá con una más larga o combinada.'
  if (error.code === 'email_address_invalid') return 'El email no es válido para crear la cuenta.'
  return 'No se pudo guardar la cuenta de acceso. Intentá nuevamente.'
}

function profileArgs(userId: string, values: UserValues) {
  return {
    target_user_id: userId,
    new_full_name: values.full_name,
    new_role: values.role,
    new_health_center_id: values.role === 'requester' ? values.health_center_id : null,
    new_areas: values.role === 'requester' ? values.areas : [],
  }
}

function revalidateUsers(userId?: string) {
  revalidatePath('/usuarios')
  if (userId) revalidatePath(`/usuarios/${userId}`)
}

// Alta: cuenta de Auth con contraseña temporal (email ya confirmado) y luego el perfil.
// Si el perfil falla, se borra la cuenta recién creada para no dejarla huérfana.
export async function createUser(values: NewUserValues): Promise<{ error: string }> {
  const parsed = newUserSchema.safeParse(values)
  if (!parsed.success) return { error: 'Revisá los datos del usuario.' }

  const { supabase } = await requireRole('admin')
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true })
  if (error || !data.user) return { error: error ? authErrorMessage(error) : 'No se pudo crear la cuenta de acceso.' }

  const userId = data.user.id
  const { error: profileError } = await supabase.rpc('admin_save_user', profileArgs(userId, parsed.data))
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(userId)
    if (rollbackError) console.error('No se pudo revertir la cuenta creada', userId, rollbackError)
    return { error: rpcErrorMessage(profileError) }
  }

  revalidateUsers()
  redirect(withFeedback(`/usuarios/${userId}`, 'success', 'usuario-creado'))
}

// Edición: primero el perfil (la base valida permisos y reglas), después el email si cambió.
export async function updateUser(userId: string, values: UserValues): Promise<{ error: string }> {
  const id = idSchema.safeParse(userId)
  const parsed = userSchema.safeParse(values)
  if (!id.success || !parsed.success) return { error: 'Revisá los datos del usuario.' }

  const { supabase } = await requireRole('admin')
  const { error: profileError } = await supabase.rpc('admin_save_user', profileArgs(id.data, parsed.data))
  if (profileError) return { error: rpcErrorMessage(profileError) }

  const admin = createSupabaseAdminClient()
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(id.data)
  if (accountError || !account.user) return { error: 'Se guardaron los datos, pero no se pudo verificar el email de la cuenta.' }
  if (account.user.email?.toLowerCase() !== parsed.data.email) {
    const { error } = await admin.auth.admin.updateUserById(id.data, { email: parsed.data.email, email_confirm: true })
    if (error) return { error: `Se guardaron los datos, pero no el email: ${authErrorMessage(error)}` }
  }

  revalidateUsers(id.data)
  redirect(withFeedback(`/usuarios/${id.data}`, 'success', 'usuario-actualizado'))
}

// Contraseña temporal: el admin la define y el usuario debe cambiarla en su próximo ingreso.
export async function setTemporaryPassword(userId: string, password: string): Promise<{ error: string }> {
  const id = idSchema.safeParse(userId)
  const parsed = passwordSchema.safeParse(password)
  if (!id.success || !parsed.success) return { error: 'Revisá la contraseña temporal.' }

  const { supabase } = await requireRole('admin')
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(id.data, { password: parsed.data })
  if (error) return { error: authErrorMessage(error) }

  const { error: profileError } = await supabase.rpc('admin_require_password_change', { target_user_id: id.data })
  if (profileError) return { error: 'Se asignó la contraseña, pero no se pudo exigir el cambio al ingresar. Intentá nuevamente.' }

  revalidateUsers(id.data)
  redirect(withFeedback(`/usuarios/${id.data}`, 'success', 'usuario-password'))
}

// Desactivar: el perfil queda sin rol (current_app_role() es null) y la cuenta, bloqueada en Auth.
// Reactivar revierte ambas cosas.
export async function toggleUserActive(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const active = formData.get('active') === 'true'
  if (!id.success) redirect(withFeedback('/usuarios', 'error', 'usuario-invalido'))

  const { supabase, userId } = await requireRole('admin')
  const page = `/usuarios/${id.data}`
  if (id.data === userId) redirect(withFeedback(page, 'error', 'usuario-propio'))

  const { error } = await supabase.rpc('admin_set_user_active', { target_user_id: id.data, new_active: !active })
  if (error) redirect(withFeedback(page, 'error', 'usuario-error'))

  const { error: banError } = await createSupabaseAdminClient().auth.admin.updateUserById(id.data, { ban_duration: active ? BANNED : 'none' })
  if (banError) {
    console.error('No se pudo cambiar el bloqueo de la cuenta', id.data, banError)
    redirect(withFeedback(page, 'error', 'usuario-bloqueo-error'))
  }

  revalidateUsers(id.data)
  redirect(withFeedback(page, 'success', active ? 'usuario-desactivado' : 'usuario-reactivado'))
}

// Eliminar: solo usuarios sin actividad (la base lo valida). Primero el perfil, después la cuenta.
export async function deleteUser(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) redirect(withFeedback('/usuarios', 'error', 'usuario-invalido'))

  const { supabase, userId } = await requireRole('admin')
  const page = `/usuarios/${id.data}`
  if (id.data === userId) redirect(withFeedback(page, 'error', 'usuario-propio'))

  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id.data })
  if (error) redirect(withFeedback(page, 'error', error.code === '23503' ? 'usuario-con-actividad' : 'usuario-error'))

  const { error: authError } = await createSupabaseAdminClient().auth.admin.deleteUser(id.data)
  revalidateUsers()
  if (authError) {
    console.error('Se eliminó el perfil pero no la cuenta de Auth', id.data, authError)
    redirect(withFeedback('/usuarios', 'error', 'usuario-eliminado-parcial'))
  }
  redirect(withFeedback('/usuarios', 'success', 'usuario-eliminado'))
}
