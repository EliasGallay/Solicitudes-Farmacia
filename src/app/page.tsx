import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell } from '../components/app-shell'
import { createSupabaseServerClient } from '../lib/supabase/server'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { count: requestCount }, { count: productCount }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('requests').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
  ])
  if (profile?.must_change_password) redirect('/change-password')

  return (
    <AppShell>
      <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
        <header className="border-b border-border pb-6">
          <span className="text-sm font-medium text-muted-foreground">Solicitudes de Farmacia</span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Panel de trabajo</h1>
          <p className="mt-2 text-muted-foreground">Hola, {profile?.full_name ?? user.email}.</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/solicitudes" className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:border-ring hover:shadow">
            <p className="text-sm text-muted-foreground">Solicitudes registradas</p>
            <p className="mt-2 text-3xl font-bold">{requestCount ?? 0}</p>
            <p className="mt-3 text-sm text-muted-foreground">Consultar historial y seguimiento</p>
          </Link>
          <Link href="/catalogos" className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:border-ring hover:shadow">
            <p className="text-sm text-muted-foreground">Productos activos</p>
            <p className="mt-2 text-3xl font-bold">{productCount ?? 0}</p>
            <p className="mt-3 text-sm text-muted-foreground">Consultar catálogos disponibles</p>
          </Link>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Acciones rápidas</h2>
          <p className="mt-2 text-muted-foreground">Elegí un módulo desde la navegación para continuar.</p>
          <Link href="/nueva-solicitud" className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90">Crear nueva solicitud</Link>
        </section>
      </div>
    </AppShell>
  )
}
