'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../../lib/feedback'
import { createSupabaseServerClient } from '../../lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) redirect(withFeedback('/login', 'error', 'login-invalido'))

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) redirect(withFeedback('/login', 'error', 'login-fallido'))
  redirect('/')
}

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
