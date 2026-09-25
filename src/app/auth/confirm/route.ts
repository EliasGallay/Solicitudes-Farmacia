import { type NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { withFeedback } from '../../../lib/feedback'
import { createSupabaseServerClient } from '../../../lib/supabase/server'

// Destino del enlace de recuperación de contraseña. Acepta los dos formatos de Supabase:
// - `code` (PKCE, plantilla de email por defecto): requiere el mismo navegador que pidió el enlace;
// - `token_hash` + `type=recovery` (plantilla personalizada): funciona desde cualquier navegador.
// Con la sesión abierta, la persona define la contraseña nueva en /change-password.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const supabase = await createSupabaseServerClient()
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type === 'recovery'
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : null

  const destination = result && !result.error ? '/change-password' : withFeedback('/login', 'error', 'enlace-invalido')
  return NextResponse.redirect(new URL(destination, request.url))
}
