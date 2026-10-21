import type { Metadata } from 'next'
import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { z } from 'zod'
import { PrintButton } from '@/components/deliveries/print-button'
import { buttonVariants } from '@/components/ui/button'
import { areaName, getAreas } from '@/lib/areas'
import { getCenters } from '@/lib/centers'
import { productTypeLabel, type ProductTypeRelation } from '@/lib/product-types'
import { requestStatusLabels, type RequestStatus } from '@/lib/request-status'
import { formatDateTime, formatRequestNumber, relationOne } from '@/lib/requests'
import { requireSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Hoja de pedido — Solicitudes de Insumos' }

type ProductRow = { name: string; presentation: string; type: ProductTypeRelation }

// Hoja de pedido imprimible: la solicitud completa (todos los productos, sin paginar) para preparar
// el pedido. Fuera del grupo (app) para imprimirse sin sidebar, como el remito. La ven el admin y el
// centro; RLS limita la solicitud a quien puede verla.
export default async function RequestSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, role, centerName: ownCenter } = await requireSession()
  const isAdmin = role === 'admin'
  const id = z.string().uuid().safeParse((await params).id)
  const { data } = id.success
    ? await supabase.from('requests').select('id, area, health_center_id, request_number, created_at, created_by, request_status, observations, purchase_requirement_number, request_items(id, requested_quantity, delivered_quantity, closed_quantity, pending_quantity, product:products(name, presentation, type:product_types(label)))').eq('id', id.data).maybeSingle()
    : { data: null }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-foreground-secondary">No encontramos la solicitud.</p>
        <Link href="/solicitudes" className={buttonVariants({ variant: 'secondary', className: 'mt-4' })}>Volver a solicitudes</Link>
      </main>
    )
  }

  // Nombre de quien pidió: el solicitante no lee perfiles ajenos.
  const [centers, areas, { data: actorRows }] = await Promise.all([
    isAdmin ? getCenters().then((result) => result ?? []) : null,
    getAreas(true).then((result) => result ?? []),
    supabase.rpc('request_actor_names', { target_request_id: data.id }),
  ])
  const names = new Map(((actorRows ?? []) as { user_id: string; full_name: string }[]).map((row) => [row.user_id, row.full_name]))
  const centerName = centers ? centers.find((center) => center.id === data.health_center_id)?.name : ownCenter
  const requestHref = `/solicitudes/${data.id}`

  const items = ((data.request_items ?? []) as { id: string; requested_quantity: number; delivered_quantity: number; closed_quantity: number; pending_quantity: number; product: ProductRow | ProductRow[] | null }[])
    .map((item) => {
      const product = relationOne(item.product)
      return {
        id: item.id,
        name: product?.name ?? 'Producto no disponible',
        presentation: product?.presentation ?? '—',
        type: product ? productTypeLabel(product.type) : '—',
        requested: item.requested_quantity,
        delivered: item.delivered_quantity,
        closed: item.closed_quantity,
        pending: item.pending_quantity,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const total = (key: 'requested' | 'delivered' | 'closed' | 'pending') => items.reduce((sum, item) => sum + item[key], 0)
  const hasClosed = total('closed') > 0

  return (
    <div className="min-h-dvh bg-page py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 px-4 print:hidden">
        <Link href={requestHref} className={buttonVariants({ variant: 'ghost' })}>Volver a la solicitud</Link>
        <PrintButton />
      </div>

      <main className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-surface p-8 text-foreground shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-foreground pb-4">
          <div className="flex items-center gap-3">
            <Landmark className="size-10 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-bold tracking-wide uppercase">Municipalidad de Funes</p>
              <p className="text-sm text-foreground-secondary">Secretaría de Salud · Solicitudes de Insumos</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-wide text-foreground-secondary uppercase">Hoja de pedido</p>
            <p className="text-2xl font-bold tabular-nums">{formatRequestNumber(data.request_number as number)}</p>
            <p className="text-sm">{formatDateTime(data.created_at as string)}</p>
          </div>
        </header>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-foreground-secondary">Centro de salud</dt><dd className="font-semibold">{centerName ?? '—'}</dd></div>
          <div><dt className="text-foreground-secondary">Estado</dt><dd className="font-semibold">{requestStatusLabels[data.request_status as RequestStatus]}</dd></div>
          {areas.length > 1 && <div><dt className="text-foreground-secondary">Rubro</dt><dd className="font-semibold">{areaName(areas, data.area as string)}</dd></div>}
          <div><dt className="text-foreground-secondary">Solicitado por</dt><dd className="font-semibold">{names.get(data.created_by as string) ?? '—'}</dd></div>
          {data.purchase_requirement_number && <div><dt className="text-foreground-secondary">Requerimiento de compra</dt><dd className="font-semibold tabular-nums">{data.purchase_requirement_number as string}</dd></div>}
        </dl>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 pr-3 font-semibold">Producto</th>
              <th className="py-2 pr-3 font-semibold">Presentación</th>
              <th className="py-2 pr-3 text-right font-semibold">Solicitado</th>
              <th className="py-2 pr-3 text-right font-semibold">Entregado</th>
              {hasClosed && <th className="py-2 pr-3 text-right font-semibold">Cerrado</th>}
              <th className="py-2 pr-3 text-right font-semibold">Pendiente</th>
              {/* Casilla para tildar a mano al preparar el pedido. */}
              {isAdmin && <th className="py-2 text-center font-semibold">Preparado</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border break-inside-avoid">
                <td className="py-2 pr-3">{item.name}<span className="block text-xs text-foreground-secondary">{item.type}</span></td>
                <td className="py-2 pr-3 text-foreground-secondary">{item.presentation}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{item.requested}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{item.delivered}</td>
                {hasClosed && <td className="py-2 pr-3 text-right tabular-nums">{item.closed}</td>}
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">{item.pending}</td>
                {isAdmin && <td className="py-2 text-center">{item.pending > 0 && <span className="inline-block size-4 border border-foreground align-middle" aria-hidden />}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <td colSpan={2} className="py-2 font-semibold">Total: {items.length} {items.length === 1 ? 'producto' : 'productos'}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{total('requested')}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{total('delivered')}</td>
              {hasClosed && <td className="py-2 pr-3 text-right font-bold tabular-nums">{total('closed')}</td>}
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{total('pending')}</td>
              {isAdmin && <td />}
            </tr>
          </tfoot>
        </table>

        {data.observations && (
          <section className="mt-6 text-sm break-inside-avoid">
            <p className="text-foreground-secondary">Observaciones</p>
            <p className="whitespace-pre-wrap">{data.observations as string}</p>
          </section>
        )}

        <p className="mt-10 text-xs text-foreground-secondary">Impreso el {formatDateTime(new Date().toISOString())}. Las cantidades entregadas y pendientes son las de ese momento.</p>
      </main>
    </div>
  )
}
