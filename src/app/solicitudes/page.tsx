import { redirect } from 'next/navigation'
import { SectionPage } from '../../components/section-page'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { EmptyState } from '../../components/empty-state'

export default async function RequestsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: requests }, { data: centers }] = await Promise.all([
    supabase.from('requests').select('id, created_at, health_center_id, request_items(requested_quantity, closed_quantity, product:products(name, presentation))').order('created_at', { ascending: false }).limit(25),
    supabase.from('health_centers').select('id, name'),
  ])

  return (
    <SectionPage title="Solicitudes" description="Consulta y seguimiento de solicitudes registradas.">
      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        {(requests ?? []).length === 0 ? <EmptyState>No hay solicitudes visibles.</EmptyState> : (
          <div className="space-y-3">
            {(requests ?? []).map((request) => {
              const centerName = (centers ?? []).find((center) => center.id === request.health_center_id)?.name ?? 'Centro'
              const openQuantity = request.request_items?.reduce((total, item) => total + item.requested_quantity - item.closed_quantity, 0) ?? 0
              return <article key={request.id} className="rounded-md border border-border p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{centerName}</span><time className="text-muted-foreground">{new Date(request.created_at).toLocaleString('es-AR')}</time></div><p className="mt-2 text-sm text-muted-foreground">Saldo abierto: {openQuantity} unidad(es)</p><ul className="mt-2 list-inside list-disc text-sm text-foreground">{request.request_items?.map((item, index) => <li key={`${request.id}-${index}`}>{item.product?.[0]?.name ?? 'Producto'}: {item.requested_quantity}</li>)}</ul></article>
            })}
          </div>
        )}
      </section>
    </SectionPage>
  )
}
