'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { withFeedback } from '../../lib/feedback'
import { createSupabaseServerClient } from '../../lib/supabase/server'

const recoverySchema = z.object({ email: z.string().trim().email() })

// Envía el enlace de recuperación. La respuesta es la misma exista o no la cuenta, para no
// revelar qué emails están registrados. Supabase solo acepta un `redirectTo` incluido en
// Authentication > URL Configuration > Redirect URLs.
export async function requestPasswordReset(formData: FormData) {
  const parsed = recoverySchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) redirect(withFeedback('/recuperar-contrasena', 'error', 'recuperacion-invalida'))

  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin') ?? `${requestHeaders.get('x-forwarded-proto') ?? 'http'}://${requestHeaders.get('host')}`
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/confirm` })

  // Límite de envíos u otra falla del servicio: se informa sin detalles técnicos.
  if (error) redirect(withFeedback('/recuperar-contrasena', 'error', 'recuperacion-error'))
  redirect(withFeedback('/recuperar-contrasena', 'success', 'recuperacion-enviada'))
}
