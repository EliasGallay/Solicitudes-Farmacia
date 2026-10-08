import Link from 'next/link'
import { Ban, CircleCheck, FilePlus2, PackageCheck, Printer, RotateCcw, TriangleAlert, Truck, Undo2, type LucideIcon } from 'lucide-react'
import { resolveReceiptDifference, voidDelivery } from '@/app/request-management-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { DeliveryStatusBadge } from '@/components/deliveries/delivery-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { closureReasonLabels, NOTE_MAX_LENGTH, receiptResolutionLabels, type ClosureReason, type ReceiptResolution } from '@/lib/request-management'
import { formatDateTime, formatDeliveryNumber } from '@/lib/requests'
import { cn } from '@/lib/utils'

// Los nombres llegan de la RPC request_actor_names; esto solo aparece si no se pudo resolver
// (p. ej. la migración 202610030001 todavía no está aplicada).
export const UNKNOWN_ACTOR = 'usuario no disponible'

// `confirmed`: el centro ya confirmó alguna línea; la entrega no se puede anular.
export type DeliverySummary = { id: string; number: number; createdAt: string; createdBy: string; units: number; products: number; note: string | null; voidedAt: string | null; voidedBy: string | null; voidReason: string | null; confirmed: boolean }
export type ClosureEvent = { at: string; by: string; reason: ClosureReason; detail: string | null; products: { name: string; quantity: number }[] }
// Una confirmación agrupa las líneas que alguien confirmó en la misma operación.
export type ReceiptEvent = { at: string; by: string; lines: { name: string; delivered: number; received: number; comment: string | null }[] }
export type ResolutionEvent = { at: string; by: string; resolution: ReceiptResolution; note: string | null; name: string; missing: number }
export type OpenDifference = { receiptId: string; name: string; deliveryNumber: number; delivered: number; received: number; comment: string | null; by: string; at: string }

function DeliveryActions({ delivery, requestId }: { delivery: DeliverySummary; requestId: string }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Link href={`/entregas/${delivery.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Ver entrega</Link>
        {!delivery.voidedAt && <Link href={`/remitos/${delivery.id}`} target="_blank" className={buttonVariants({ variant: 'secondary', size: 'sm' })}><Printer />Remito</Link>}
        {delivery.confirmed && <ReceiptNoteLink deliveryId={delivery.id} />}
      </div>
      {/* Con la recepción confirmada por el centro, la entrega ya no se anula. */}
      {!delivery.voidedAt && !delivery.confirmed && <VoidDeliveryForm deliveryId={delivery.id} requestId={requestId} number={delivery.number} from="solicitud" />}
    </div>
  )
}

// Constancia imprimible de lo que el centro confirmó haber recibido (/recepciones/[id]).
function ReceiptNoteLink({ deliveryId }: { deliveryId: string }) {
  return <Link href={`/recepciones/${deliveryId}`} target="_blank" className={buttonVariants({ variant: 'secondary', size: 'sm' })}><Printer />Constancia de recepción</Link>
}

// Anulación con motivo obligatorio. Plegada por defecto para no invitar a usarla por error.
export function VoidDeliveryForm({ deliveryId, requestId, number, from }: { deliveryId: string; requestId: string; number: number; from: 'solicitud' | 'entrega' }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium text-danger hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 [&::-webkit-details-marker]:hidden">
        <Undo2 className="size-4" aria-hidden />Anular esta entrega
      </summary>
      <form action={voidDelivery} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="delivery_id" value={deliveryId} />
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="from" value={from} />
        <Input name="reason" required maxLength={NOTE_MAX_LENGTH} aria-label="Motivo de la anulación" placeholder="Motivo (obligatorio), ej.: cantidades cargadas por error" className="min-w-0 flex-1" />
        <ConfirmSubmit variant="destructive" size="sm" title={`Anular ${formatDeliveryNumber(number)}`} description="Sus cantidades vuelven a quedar pendientes en la solicitud. La entrega queda en el historial como anulada." confirmLabel="Anular entrega">Anular</ConfirmSubmit>
      </form>
    </details>
  )
}

// Diferencias de recepción sin resolver (solo admin): por cada una, volver a pendiente o cerrar el faltante.
export function ReceiptDifferences({ requestId, differences }: { requestId: string; differences: OpenDifference[] }) {
  if (differences.length === 0) return null
  return (
    <Card className="mb-6 border-warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TriangleAlert className="size-5 text-warning" aria-hidden />Diferencias en la recepción</CardTitle>
        <CardDescription>El centro informó una cantidad recibida menor a la entregada. Mientras no se resuelvan, la solicitud no se da por recibida.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {differences.map((difference) => {
            const missing = difference.delivered - difference.received
            return (
              <li key={difference.receiptId} className="flex flex-col gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">{difference.name}</p>
                  <p className="text-sm text-foreground-secondary">
                    Remito {formatDeliveryNumber(difference.deliveryNumber)}: entregado <span className="font-semibold text-foreground tabular-nums">{difference.delivered}</span>, recibido <span className="font-semibold text-foreground tabular-nums">{difference.received}</span> · <span className="font-semibold text-warning">faltante: {missing}</span>
                  </p>
                  <p className="mt-1 text-sm">«{difference.comment}» <span className="text-foreground-secondary">— {difference.by}, {formatDateTime(difference.at)}</span></p>
                </div>
                <form action={resolveReceiptDifference} className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <input type="hidden" name="request_id" value={requestId} />
                  <input type="hidden" name="receipt_id" value={difference.receiptId} />
                  <Input name="note" maxLength={NOTE_MAX_LENGTH} aria-label={`Nota sobre la diferencia de ${difference.name}`} placeholder="Nota (opcional)" className="min-w-0 flex-1" />
                  <div className="grid grid-cols-2 gap-2 lg:flex">
                    <ConfirmSubmit name="resolution" value="reenviar" variant="secondary" size="sm" tone="default" title="Volver a pendiente" description={`Las ${missing} unidades que faltaron de ${difference.name} vuelven a quedar pendientes para registrar una nueva entrega.`}>
                      <RotateCcw />Volver a pendiente
                    </ConfirmSubmit>
                    <ConfirmSubmit name="resolution" value="cerrar" variant="destructive" size="sm" title="Cerrar faltante" description={`Las ${missing} unidades que faltaron de ${difference.name} se cierran y no se van a reenviar.`}>
                      Cerrar faltante
                    </ConfirmSubmit>
                  </div>
                </form>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// `delivery`: en el evento de registro de una entrega, para mostrar su estado y sus acciones.
type HistoryEvent = { at: string; icon: LucideIcon; tone: string; title: string; detail?: string; delivery?: DeliverySummary }

function receiptDetail(event: ReceiptEvent) {
  return event.lines.map((line) => line.received === line.delivered
    ? `${line.name} (${line.received})`
    : `${line.name}: recibido ${line.received} de ${line.delivered}${line.comment ? ` («${line.comment}»)` : ''}`).join(' · ')
}

// Historial único de la solicitud: creación, entregas, anulaciones, recepciones y cierres, armado
// con los datos de negocio (visibles también para el solicitante). En cada entrega, el admin puede
// ver el detalle, imprimir el remito y anular.
export function RequestHistory({ requestId, isAdmin, createdAt, createdBy, deliveries, closures, receipts, resolutions }: { requestId: string; isAdmin: boolean; createdAt: string; createdBy: string; deliveries: DeliverySummary[]; closures: ClosureEvent[]; receipts: ReceiptEvent[]; resolutions: ResolutionEvent[] }) {
  const events: HistoryEvent[] = [
    { at: createdAt, icon: FilePlus2, tone: 'bg-primary-100 text-primary-600', title: `Solicitud creada por ${createdBy}` },
    ...deliveries.flatMap((delivery): HistoryEvent[] => [
      { at: delivery.createdAt, icon: Truck, tone: 'bg-success-muted text-success', title: `Entrega ${formatDeliveryNumber(delivery.number)} registrada por ${delivery.createdBy}`, detail: [`${delivery.units} ${delivery.units === 1 ? 'unidad' : 'unidades'} en ${delivery.products} ${delivery.products === 1 ? 'producto' : 'productos'}`, delivery.note].filter(Boolean).join(' · '), delivery },
      ...(delivery.voidedAt ? [{ at: delivery.voidedAt, icon: Undo2, tone: 'bg-danger-muted text-danger', title: `Entrega ${formatDeliveryNumber(delivery.number)} anulada por ${delivery.voidedBy}`, detail: delivery.voidReason ?? undefined }] : []),
    ]),
    ...receipts.map((receipt): HistoryEvent => {
      const withDifference = receipt.lines.some((line) => line.received < line.delivered)
      return {
        at: receipt.at,
        icon: withDifference ? TriangleAlert : PackageCheck,
        tone: withDifference ? 'bg-warning-muted text-warning' : 'bg-success-muted text-success',
        title: `${withDifference ? 'Recepción con diferencia' : 'Recepción confirmada'} por ${receipt.by}`,
        detail: receiptDetail(receipt),
      }
    }),
    ...resolutions.map((resolution): HistoryEvent => ({
      at: resolution.at,
      icon: resolution.resolution === 'reenviar' ? RotateCcw : CircleCheck,
      tone: 'bg-surface-muted text-foreground-secondary',
      title: `Diferencia resuelta por ${resolution.by}: ${receiptResolutionLabels[resolution.resolution]}`,
      detail: [`${resolution.name} (${resolution.missing})`, resolution.note].filter(Boolean).join(' · '),
    })),
    ...closures.map((closure): HistoryEvent => ({
      at: closure.at,
      icon: closure.reason === 'cancelada' ? Ban : CircleCheck,
      tone: 'bg-surface-muted text-foreground-secondary',
      title: closure.reason === 'cancelada' ? `Solicitud cancelada por ${closure.by}` : `Pendiente cerrado por ${closure.by}: ${closureReasonLabels[closure.reason]}`,
      detail: [closure.detail, closure.products.map((product) => `${product.name} (${product.quantity})`).join(', ')].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-5">
          {events.map((event, index) => (
            <li key={index} className="relative flex gap-3">
              {index < events.length - 1 && <span className="absolute top-9 bottom-[-1.25rem] left-4 w-px bg-border" aria-hidden />}
              <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full', event.tone)}><event.icon className="size-4" aria-hidden /></span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm leading-5 font-semibold text-foreground">{event.title}</p>
                  {event.delivery?.voidedAt && <DeliveryStatusBadge voided />}
                </div>
                <p className="text-xs leading-4 text-foreground-secondary">{formatDateTime(event.at)}</p>
                {event.detail && <p className="mt-1 text-sm break-words whitespace-pre-wrap text-foreground-secondary">{event.detail}</p>}
                {isAdmin && event.delivery && <DeliveryActions delivery={event.delivery} requestId={requestId} />}
                {/* El centro imprime la constancia de lo que confirmó haber recibido. */}
                {!isAdmin && event.delivery?.confirmed && <div className="mt-2"><ReceiptNoteLink deliveryId={event.delivery.id} /></div>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
