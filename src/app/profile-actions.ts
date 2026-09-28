'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../lib/feedback'
import { requireSession } from '../lib/session'
import { passwordSchema, profileSchema, type ProfileValues } from '../lib/users'

// Datos personales del usuario logueado (/perfil). El nombre pasa por update_own_profile
// (202610010001_own_profile.sql); la contraseña, por Supabase Auth con la sesión propia.

export async function updateOwnProfile(values: ProfileValues): Promise<{ error: string }> {
  const parsed = profileSchema.safeParse(values)
  if (!parsed.success) return { error: 'Revisá tu nombre.' }

  const { supabase } = await requireSession()
  const { error } = await supabase.rpc('update_own_profile', { new_full_name: parsed.data.full_name })
  if (error) return { error: 'No se pudieron guardar tus datos. Intentá nuevamente.' }

  // El nombre también se muestra en el sidebar, que vive en el layout.
  revalidatePath('/', 'layout')
  redirect(withFeedback('/perfil', 'success', 'perfil-actualizado'))
}

const newPasswordSchema = z.object({ password: passwordSchema, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation)

export async function changeOwnPassword(formData: FormData) {
  const parsed = newPasswordSchema.safeParse({ password: formData.get('password'), confirmation: formData.get('confirmation') })
  if (!parsed.success) redirect(withFeedback('/perfil', 'error', 'password-invalida'))

  const { supabase } = await requireSession()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    const code = error.code === 'same_password' ? 'password-igual' : error.code === 'weak_password' ? 'password-debil' : 'password-error'
    redirect(withFeedback('/perfil', 'error', code))
  }
  redirect(withFeedback('/perfil', 'success', 'perfil-password'))
}
