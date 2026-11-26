import { NextResponse, type NextRequest } from 'next/server'
import { withFeedback } from '@/lib/feedback'
import { getSession } from '@/lib/session'

// Cierre de sesión de una cuenta sin rol (perfil inactivo o inexistente) con un token todavía vigente:
// requireSession redirige acá porque una página no puede borrar las cookies de sesión, y el middleware
// devolvería /login a / mientras el token siga siendo válido. Solo cierra la sesión si realmente no
// hay rol, así un enlace externo no puede desloguear a un usuario activo.
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (session?.role) return NextResponse.redirect(new URL('/', request.url))
  if (session) await session.supabase.auth.signOut()
  return NextResponse.redirect(new URL(withFeedback('/login', 'error', 'cuenta-inactiva'), request.url))
}
