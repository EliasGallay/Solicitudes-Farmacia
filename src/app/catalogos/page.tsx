import { redirect } from 'next/navigation'
import { AppShell } from '../../components/app-shell'
import { createProduct, toggleProduct, updateProduct } from '../product-actions'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function CatalogsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: centers }] = await Promise.all([
    supabase.from('profiles').select('role, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, presentation, active').order('name'),
    supabase.from('health_centers').select('id, name, active').order('name'),
  ])
  if (profile?.must_change_password) redirect('/change-password')
  if (profile?.role !== 'admin') redirect('/?error=Solo+un+administrador+puede+gestionar+catálogos')
  const params = await searchParams

  return (
    <AppShell>
      <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Catálogos</h1>
          <p className="mt-2 text-slate-600">Administrá los productos disponibles para las solicitudes.</p>
        </header>

        {params.error && <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
        {params.success && <p className="mt-6 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{params.success}</p>}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Nuevo producto</h2>
          <form action={createProduct} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block text-sm font-medium">Nombre<input name="name" required maxLength={150} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm font-medium">Presentación<input name="presentation" required maxLength={150} placeholder="unidad, caja, frasco..." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Agregar</button>
          </form>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Productos</h2><span className="text-sm text-slate-500">{(products ?? []).length} registro(s)</span></div>
          <div className="mt-4 space-y-4">
            {(products ?? []).map((product) => (
              <div key={product.id} className="rounded-lg border border-slate-200 p-4">
                <form action={updateProduct} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <input type="hidden" name="id" value={product.id} />
                  <label className="block text-sm font-medium">Nombre<input name="name" defaultValue={product.name} required maxLength={150} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
                  <label className="block text-sm font-medium">Presentación<input name="presentation" defaultValue={product.presentation} required maxLength={150} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
                  <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Guardar</button>
                </form>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className={product.active ? 'text-emerald-700' : 'text-slate-500'}>{product.active ? 'Activo' : 'Inactivo'}</span>
                  <form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(product.active)} /><button type="submit" className="text-slate-600 underline hover:text-slate-950">{product.active ? 'Desactivar' : 'Reactivar'}</button></form>
                </div>
              </div>
            ))}
            {(products ?? []).length === 0 && <p className="text-sm text-slate-600">No hay productos cargados.</p>}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Centros de salud</h2>
          <ul className="mt-4 grid gap-2 text-sm md:grid-cols-3">{(centers ?? []).map((center) => <li key={center.id} className="rounded-md border border-slate-100 p-3"><span className="font-medium">{center.name}</span><span className="ml-2 text-slate-500">{center.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul>
        </section>
      </div>
    </AppShell>
  )
}
