import type { Metadata } from 'next'
import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { z } from 'zod'
import { PrintButton } from '@/components/deliveries/print-button'
import { buttonVariants } from '@/components/ui/button'
import { areaName, getAreas } from '@/lib/areas'
import { getCenters } from '@/lib/centers'
import { getDelivery } from '@/lib/deliveries'
import { formatDateTime, formatDeliveryNumber, formatRequestNumber } from '@/lib/requests'
import { requireRole } from '@/lib/session'

export const metadata: Metadata = { title: 'Remito — Solicitudes de Insumos' }

// Remito imprimible de una entrega (docs/plans/plan-gestion-solicitudes.md, fase 5). Fuera del
// grupo (app) para imprimirse sin sidebar; los estilos `print:` ajustan márgenes y ocultan la barra.
export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const delivery = id.success ? await getDelivery(supabase, id.data).catch(() => null) : null

  if (!delivery) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-foreground-secondary">No encontramos la entrega.</p>
        <Link href="/entregas" className={buttonVariants({ variant: 'secondary', className: 'mt-4' })}>Volver a entregas</Link>
      </main>
    )
  }

  const [centers, areas] = await Promise.all([getCenters().then((result) => result ?? []), getAreas(true).then((result) => result ?? [])])
  const centerName = centers.find((center) => center.id === delivery.request.healthCenterId)?.name ?? '—'
  const units = delivery.items.reduce((total, item) => total + item.quantity, 0)
  const voided = Boolean(delivery.voidedAt)

  return (
    <div className="min-h-dvh bg-page py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 px-4 print:hidden">
        <Link href={`/entregas/${delivery.id}`} className={buttonVariants({ variant: 'ghost' })}>Volver a la entrega</Link>
        <PrintButton />
      </div>

      <main className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-surface p-8 text-foreground shadow-card print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {voided && (
          <p className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-7xl font-black tracking-widest text-danger/20 uppercase select-none" aria-hidden>Anulado</p>
        )}

        <header className="flex items-start justify-between gap-6 border-b-2 border-foreground pb-4">
          <div className="flex items-center gap-3">
            <Landmark className="size-10 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-bold tracking-wide uppercase">Municipalidad de Funes</p>
              <p className="text-sm text-foreground-secondary">Secretaría de Salud · Solicitudes de Insumos</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-wide text-foreground-secondary uppercase">Remito</p>
            <p className="text-2xl font-bold tabular-nums">{formatDeliveryNumber(delivery.number)}</p>
            <p className="text-sm">{formatDateTime(delivery.createdAt)}</p>
          </div>
        </header>

        {voided && <p className="mt-4 rounded-md border border-danger p-3 text-sm text-danger">Remito anulado el {formatDateTime(delivery.voidedAt!)} por {delivery.voidedBy}. Motivo: {delivery.voidReason}.</p>}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-foreground-secondary">Centro de salud</dt><dd className="font-semibold">{centerName}</dd></div>
          <div><dt className="text-foreground-secondary">Solicitud</dt><dd className="font-semibold">{formatRequestNumber(delivery.request.number)} · {formatDateTime(delivery.request.createdAt)}</dd></div>
          {areas.length > 1 && <div><dt className="text-foreground-secondary">Rubro</dt><dd className="font-semibold">{areaName(areas, delivery.request.area)}</dd></div>}
          {delivery.request.createdBy && <div><dt className="text-foreground-secondary">Solicitado por</dt><dd className="font-semibold">{delivery.request.createdBy}</dd></div>}
        </dl>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 pr-3 font-semibold">Producto</th>
              <th className="py-2 pr-3 font-semibold">Presentación</th>
              <th className="py-2 text-right font-semibold">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {delivery.items.map((item) => (
              <tr key={item.id} className="border-b border-border break-inside-avoid">
                <td className="py-2 pr-3">{item.name}</td>
                <td className="py-2 pr-3 text-foreground-secondary">{item.presentation}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <td colSpan={2} className="py-2 font-semibold">Total: {delivery.items.length} {delivery.items.length === 1 ? 'producto' : 'productos'}</td>
              <td className="py-2 text-right font-bold tabular-nums">{units}</td>
            </tr>
          </tfoot>
        </table>

        {delivery.note && (
          <section className="mt-6 text-sm">
            <p className="text-foreground-secondary">Nota</p>
            <p className="whitespace-pre-wrap">{delivery.note}</p>
          </section>
        )}

        <section className="mt-16 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
          <div>
            <div className="h-16 border-b border-foreground" />
            <p className="mt-2 font-semibold">Entregó</p>
            <p className="text-foreground-secondary">{delivery.createdBy}</p>
          </div>
          <div>
            <div className="h-16 border-b border-foreground" />
            <p className="mt-2 font-semibold">Recibió</p>
            <p className="text-foreground-secondary">Firma, aclaración y fecha</p>
          </div>
        </section>
      </main>
    </div>
  )
}
