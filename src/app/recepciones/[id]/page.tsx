import type { Metadata } from 'next'
import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { z } from 'zod'
import { PrintButton } from '@/components/deliveries/print-button'
import { buttonVariants } from '@/components/ui/button'
import { areaName, getAreas } from '@/lib/areas'
import { getDelivery, type DeliveryDetail } from '@/lib/deliveries'
import { formatDateTime, formatDeliveryNumber, formatRequestNumber } from '@/lib/requests'
import { requireSession } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Constancia de recepción — Solicitudes de Insumos' }

type Item = DeliveryDetail['items'][number]

// Estado de una línea en la constancia: lo que el centro informó y, si faltó algo, qué se resolvió.
function lineStatus(item: Item) {
  const receipt = item.receipt
  if (!receipt) return { text: 'Sin confirmar', tone: 'text-foreground-secondary' }
  if (receipt.received >= item.quantity) return { text: 'Conforme', tone: 'text-success' }
  const missing = item.quantity - receipt.received
  const resolution = receipt.resolution === 'reenviar' ? 'se reenvía' : receipt.resolution === 'cerrar' ? 'faltante cerrado' : 'en revisión'
  return { text: `Faltó ${missing} (${resolution})`, tone: 'text-warning' }
}

// Constancia de recepción de una entrega, para que el centro imprima lo que recibió. Fuera del grupo
// (app) para imprimirse sin sidebar, como el remito. La ven el centro y el admin; RLS limita la
// entrega a quien puede ver la solicitud.
export default async function ReceiptNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, centerName: ownCenter } = await requireSession()
  const id = z.string().uuid().safeParse((await params).id)
  const delivery = id.success ? await getDelivery(supabase, id.data).catch(() => null) : null

  if (!delivery) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-foreground-secondary">No encontramos la entrega.</p>
        <Link href="/solicitudes" className={buttonVariants({ variant: 'secondary', className: 'mt-4' })}>Volver a solicitudes</Link>
      </main>
    )
  }

  const requestHref = `/solicitudes/${delivery.request.id}`
  const confirmed = delivery.items.filter((item) => item.receipt)
  if (confirmed.length === 0 || delivery.voidedAt) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-foreground-secondary">
          {delivery.voidedAt
            ? `La entrega ${formatDeliveryNumber(delivery.number)} fue anulada: no tiene constancia de recepción.`
            : `Todavía no se confirmó la recepción de la entrega ${formatDeliveryNumber(delivery.number)}.`}
        </p>
        <Link href={requestHref} className={buttonVariants({ variant: 'secondary', className: 'mt-4' })}>Volver a la solicitud</Link>
      </main>
    )
  }

  // Nombres de quien entregó y de quienes confirmaron: el solicitante no lee perfiles ajenos.
  const [{ data: actorRows }, areas] = await Promise.all([
    supabase.rpc('request_actor_names', { target_request_id: delivery.request.id }),
    getAreas(true).then((result) => result ?? []),
  ])
  const names = new Map(((actorRows ?? []) as { user_id: string; full_name: string }[]).map((row) => [row.user_id, row.full_name]))
  const deliveredBy = names.get(delivery.createdById) ?? delivery.createdBy

  // Una confirmación agrupa las líneas que alguien confirmó en la misma operación.
  const confirmations = new Map<string, { at: string; by: string }>()
  for (const item of confirmed) {
    const receipt = item.receipt!
    confirmations.set(`${receipt.confirmedAt}|${receipt.confirmedBy}`, { at: receipt.confirmedAt, by: names.get(receipt.confirmedBy) ?? '—' })
  }
  const confirmationList = [...confirmations.values()].sort((a, b) => a.at.localeCompare(b.at))

  const deliveredUnits = delivery.items.reduce((total, item) => total + item.quantity, 0)
  const receivedUnits = confirmed.reduce((total, item) => total + item.receipt!.received, 0)
  const pendingLines = delivery.items.length - confirmed.length
  const comments = delivery.items.filter((item) => item.receipt?.comment)

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
            <p className="text-xs tracking-wide text-foreground-secondary uppercase">Constancia de recepción</p>
            <p className="text-2xl font-bold tabular-nums">{formatDeliveryNumber(delivery.number)}</p>
            <p className="text-sm">Entregado el {formatDateTime(delivery.createdAt)}</p>
          </div>
        </header>

        {pendingLines > 0 && (
          <p className="mt-4 rounded-md border border-warning p-3 text-sm text-warning">
            Recepción parcial: {pendingLines === 1 ? 'falta confirmar 1 producto' : `faltan confirmar ${pendingLines} productos`} de esta entrega.
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-foreground-secondary">Centro de salud</dt><dd className="font-semibold">{delivery.request.centerName ?? ownCenter ?? '—'}</dd></div>
          <div><dt className="text-foreground-secondary">Solicitud</dt><dd className="font-semibold">{formatRequestNumber(delivery.request.number)} · {formatDateTime(delivery.request.createdAt)}</dd></div>
          {areas.length > 1 && <div><dt className="text-foreground-secondary">Rubro</dt><dd className="font-semibold">{areaName(areas, delivery.request.area)}</dd></div>}
          <div><dt className="text-foreground-secondary">Entregó</dt><dd className="font-semibold">{deliveredBy}</dd></div>
        </dl>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 pr-3 font-semibold">Producto</th>
              <th className="py-2 pr-3 font-semibold">Presentación</th>
              <th className="py-2 pr-3 text-right font-semibold">Entregado</th>
              <th className="py-2 pr-3 text-right font-semibold">Recibido</th>
              <th className="py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {delivery.items.map((item) => {
              const status = lineStatus(item)
              return (
                <tr key={item.id} className="border-b border-border break-inside-avoid">
                  <td className="py-2 pr-3">{item.name}</td>
                  <td className="py-2 pr-3 text-foreground-secondary">{item.presentation}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{item.receipt ? item.receipt.received : '—'}</td>
                  <td className={cn('py-2 text-xs font-medium print:text-foreground', status.tone)}>{status.text}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground">
              <td colSpan={2} className="py-2 font-semibold">Total: {delivery.items.length} {delivery.items.length === 1 ? 'producto' : 'productos'}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{deliveredUnits}</td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums">{receivedUnits}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {comments.length > 0 && (
          <section className="mt-6 text-sm break-inside-avoid">
            <p className="text-foreground-secondary">Observaciones de la recepción</p>
            <ul className="mt-1 flex flex-col gap-1">
              {comments.map((item) => <li key={item.id}><span className="font-semibold">{item.name}:</span> <span className="whitespace-pre-wrap">{item.receipt!.comment}</span></li>)}
            </ul>
          </section>
        )}

        <section className="mt-6 text-sm break-inside-avoid">
          <p className="text-foreground-secondary">Recepción confirmada en el sistema</p>
          <ul className="mt-1">
            {confirmationList.map((confirmation) => <li key={`${confirmation.at}|${confirmation.by}`}><span className="font-semibold">{confirmation.by}</span> · {formatDateTime(confirmation.at)}</li>)}
          </ul>
        </section>

        <section className="mt-16 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
          <div>
            <div className="h-16 border-b border-foreground" />
            <p className="mt-2 font-semibold">Recibió</p>
            <p className="text-foreground-secondary">Firma, aclaración y fecha</p>
          </div>
          <div>
            <div className="h-16 border-b border-foreground" />
            <p className="mt-2 font-semibold">Responsable del centro</p>
            <p className="text-foreground-secondary">Firma y sello</p>
          </div>
        </section>
      </main>
    </div>
  )
}
