import { redirect } from 'next/navigation'
import { SectionPage } from '../../components/section-page'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function CatalogsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: products }, { data: centers }] = await Promise.all([
    supabase.from('products').select('id, name, presentation, active').order('name'),
    supabase.from('health_centers').select('id, name, active').order('name'),
  ])

  return (
    <SectionPage title="Catálogos" description="Centros de salud y productos disponibles para las solicitudes.">
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Centros de salud</h2><ul className="mt-4 space-y-2 text-sm">{(centers ?? []).map((center) => <li key={center.id} className="flex justify-between"><span>{center.name}</span><span className="text-slate-500">{center.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul></section>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold">Productos</h2><ul className="mt-4 space-y-2 text-sm">{(products ?? []).map((product) => <li key={product.id} className="flex justify-between gap-3"><span>{product.name} · {product.presentation}</span><span className="text-slate-500">{product.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul></section>
      </div>
    </SectionPage>
  )
}
