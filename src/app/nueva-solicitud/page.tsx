import { redirect } from 'next/navigation'
import { AppShell } from '../../components/app-shell'
import { createRequest } from '../request-actions'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: centers }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, health_center_id, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, presentation').eq('active', true).order('name'),
    supabase.from('health_centers').select('id, name').eq('active', true).order('name'),
  ])
  if (profile?.must_change_password) redirect('/change-password')

  const params = await searchParams
  const availableCenters = profile?.role === 'admin'
    ? centers ?? []
    : (centers ?? []).filter((center) => center.id === profile?.health_center_id)

  return (
    <AppShell>
      <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Nueva solicitud</h1>
          <p className="mt-2 text-slate-600">Cargá los productos y cantidades que necesitás.</p>
        </header>
        {params.error && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
        {params.success && <p className="mt-6 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action={createRequest} className="space-y-5">
            <label className="block max-w-md text-sm font-medium">
              Centro de salud
              <select name="health_center_id" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                <option value="">Seleccionar centro</option>
                {availableCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {(products ?? []).map((product) => (
                <label key={product.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3 text-sm">
                  <span><span className="font-medium">{product.name}</span><span className="block text-slate-500">{product.presentation}</span></span>
                  <input name={`quantity_${product.id}`} type="number" min="0" step="1" defaultValue="0" className="w-24 rounded-md border border-slate-300 px-3 py-2 text-right" />
                </label>
              ))}
            </div>
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Crear solicitud</button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
