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
        <header className="border-b border-slate-200 pb-6">
          <span className="text-sm font-medium text-slate-500">Solicitudes de Farmacia</span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Panel de trabajo</h1>
          <p className="mt-2 text-slate-600">Hola, {profile?.full_name ?? user.email}.</p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/solicitudes" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow">
            <p className="text-sm text-slate-500">Solicitudes registradas</p>
            <p className="mt-2 text-3xl font-bold">{requestCount ?? 0}</p>
            <p className="mt-3 text-sm text-slate-600">Consultar historial y seguimiento</p>
          </Link>
          <Link href="/catalogos" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow">
            <p className="text-sm text-slate-500">Productos activos</p>
            <p className="mt-2 text-3xl font-bold">{productCount ?? 0}</p>
            <p className="mt-3 text-sm text-slate-600">Consultar catálogos disponibles</p>
          </Link>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Acciones rápidas</h2>
          <p className="mt-2 text-slate-600">Elegí un módulo desde la navegación para continuar.</p>
          <Link href="/nueva-solicitud" className="mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Crear nueva solicitud</Link>
        </section>
      </div>
    </AppShell>
  )
}
