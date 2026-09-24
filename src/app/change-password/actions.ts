'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../../lib/feedback'
import { createSupabaseServerClient } from '../../lib/supabase/server'

const passwordSchema = z.object({
  password: z.string().min(8),
  confirmation: z.string().min(8),
}).refine((values) => values.password === values.confirmation, {
  message: 'Las contraseñas no coinciden',
})

export async function changePassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirmation: formData.get('confirmation'),
  })
  if (!parsed.success) redirect(withFeedback('/change-password', 'error', 'password-invalida'))

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(withFeedback('/login', 'error', 'sesion-expirada'))

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (passwordError) {
    // Errores conocidos de Supabase Auth con mensaje propio; el resto, genérico.
    const code = passwordError.code === 'same_password' ? 'password-igual' : passwordError.code === 'weak_password' ? 'password-debil' : 'password-error'
    redirect(withFeedback('/change-password', 'error', code))
  }

  const { error: profileError } = await supabase.rpc('complete_password_change')
  if (profileError) redirect(withFeedback('/change-password', 'error', 'password-error'))
  redirect('/')
}
