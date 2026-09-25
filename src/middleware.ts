import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type SetAllCookies } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  // /auth/confirm valida el enlace de recuperación de contraseña, con o sin sesión previa.
  if (pathname === '/auth/confirm') return response
  const publicPath = pathname === '/login' || pathname === '/recuperar-contrasena'
  if (!user && !publicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && publicPath) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
