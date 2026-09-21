'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
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
  if (!parsed.success) redirect('/change-password?error=La+contraseña+debe+tener+8+caracteres+y+coincidir')

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=La+sesión+expiró')

  const { error: passwordError } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (passwordError) redirect(`/change-password?error=${encodeURIComponent(passwordError.message)}`)

  const { error: profileError } = await supabase.rpc('complete_password_change')
  if (profileError) redirect(`/change-password?error=${encodeURIComponent(profileError.message)}`)
  redirect('/')
}
