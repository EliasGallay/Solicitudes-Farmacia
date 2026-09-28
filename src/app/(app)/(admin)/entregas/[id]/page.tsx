import Link from 'next/link'
import { PackageX, Printer } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { CenterBadge } from '@/components/center-badge'
import { DeliveryStatusBadge, ReceiptStateBadge } from '@/components/deliveries/delivery-status-badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { VoidDeliveryForm } from '@/components/requests/request-activity'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MobileList, MobileListHeader, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { areaName, getAreas } from '@/lib/areas'
import { centerTone, getCenters } from '@/lib/centers'
import { getDelivery, receiptState, type LineReceipt } from '@/lib/deliveries'
import { feedbackMessage } from '@/lib/feedback'
import { formatDateTime, formatDeliveryNumber, formatRequestNumber } from '@/lib/requests'
import { requireRole } from '@/lib/session'

export default async function DeliveryDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const feedback = await searchParams
  if (!id.success) return <><BackButton fallback="/entregas" /><NotFound /></>

  const [delivery, centers, areas] = await Promise.all([
    getDelivery(supabase, id.data).catch(() => undefined),
    getCenters().then((result) => result ?? []),
    getAreas(true).then((result) => result ?? []),
  ])
  if (delivery === undefined) return <><BackButton fallback="/entregas" /><Card><ErrorState title="No pudimos cargar la entrega" /></Card></>
  if (!delivery) return <><BackButton fallback="/entregas" /><NotFound /></>

  const voided = Boolean(delivery.voidedAt)
  const receipt = receiptState(delivery.items)
  // Con alguna línea confirmada por el centro, la entrega ya no se anula (la base también lo rechaza).
  const canVoid = !voided && receipt === 'sin_confirmar'
  const centerId = delivery.request.healthCenterId
  const centerName = centers.find((center) => center.id === centerId)?.name ?? 'Centro no disponible'
  const units = delivery.items.reduce((total, item) => total + item.quantity, 0)
  const requestHref = `/solicitudes/${delivery.request.id}`

  return (
    <>
      <BackButton fallback="/entregas" />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Entrega {formatDeliveryNumber(delivery.number)}<DeliveryStatusBadge voided={voided} />{!voided && <ReceiptStateBadge state={receipt} />}<CenterBadge name={centerName} tone={centerTone(centers, centerId)} className="text-sm" /></span>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{formatDateTime(delivery.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>Registró: <span className="font-semibold text-foreground">{delivery.createdBy}</span></span>
            <span aria-hidden>·</span>
            <span>Solicitud <Link href={requestHref} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(delivery.request.number)}</Link></span>
            {areas.length > 1 && <><span aria-hidden>·</span><span>Rubro: {areaName(areas, delivery.request.area)}</span></>}
          </span>
        }
        actions={!voided && <Link href={`/remitos/${delivery.id}`} target="_blank" className={buttonVariants()}><Printer />Imprimir remito</Link>}
      />
      {feedbackMessage(feedback.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedback.error)}</FormError></div>}

      {voided && (
        <Card className="mb-6 border-danger bg-danger-muted/40">
          <CardHeader>
            <CardTitle className="text-danger">Entrega anulada</CardTitle>
            <CardDescription>El {formatDateTime(delivery.voidedAt!)} por {delivery.voidedBy}. Motivo: {delivery.voidReason}. Sus cantidades no cuentan como entregadas.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Productos entregados</CardTitle>
          <CardDescription>{units} {units === 1 ? 'unidad' : 'unidades'} en {delivery.items.length} {delivery.items.length === 1 ? 'producto' : 'productos'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <MobileList>
            {delivery.items.map((item) => (
              <MobileListItem key={item.id}>
                <MobileListHeader title={item.name} subtitle={`${item.presentation} · Solicitado: ${item.requested}`} aside={<span className="text-lg font-bold tabular-nums">{item.quantity}</span>} />
                {!voided && <p className="text-xs"><LineReceiptText quantity={item.quantity} receipt={item.receipt} /></p>}
              </MobileListItem>
            ))}
          </MobileList>
          <Table containerClassName="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Presentación</TableHead>
                <TableHead className="text-right">Solicitado</TableHead>
                <TableHead className="text-right">Entregado en este remito</TableHead>
                {!voided && <TableHead>Recepción</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {delivery.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.name}</TableCell>
                  <TableCell className="text-foreground-secondary">{item.presentation}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.requested}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{item.quantity}</TableCell>
                  {!voided && <TableCell className="text-sm"><LineReceiptText quantity={item.quantity} receipt={item.receipt} /></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Nota</CardTitle></CardHeader>
        <CardContent>
          {delivery.note
            ? <p className="text-sm leading-5 whitespace-pre-wrap">{delivery.note}</p>
            : <p className="text-sm leading-5 text-foreground-secondary">Sin nota.</p>}
        </CardContent>
      </Card>

      {canVoid && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Anular entrega</CardTitle>
            <CardDescription>Usalo si la entrega se cargó por error o no salió. Las cantidades vuelven a quedar pendientes en la solicitud y la entrega queda en el historial como anulada.</CardDescription>
          </CardHeader>
          <CardContent><VoidDeliveryForm deliveryId={delivery.id} requestId={delivery.request.id} number={delivery.number} from="entrega" /></CardContent>
        </Card>
      )}
    </>
  )
}

// Recepción de una línea: sin confirmar, recibida completa o con diferencia (y cómo se resolvió).
function LineReceiptText({ quantity, receipt }: { quantity: number; receipt: LineReceipt | null }) {
  if (!receipt) return <span className="text-foreground-secondary">Sin confirmar</span>
  if (receipt.received === quantity) return <span className="font-semibold text-success">Recibido conforme</span>
  const resolution = receipt.resolution === 'reenviar' ? ' · faltante vuelto a pendiente' : receipt.resolution === 'cerrar' ? ' · faltante cerrado' : ' · sin resolver'
  return (
    <span className={receipt.resolution ? 'text-foreground-secondary' : 'font-semibold text-danger'}>
      Recibido: {receipt.received} de {quantity}{resolution}
      {receipt.comment && <span className="block font-normal text-foreground-secondary">«{receipt.comment}»</span>}
    </span>
  )
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon={PackageX} title="No encontramos la entrega" action={<Link href="/entregas" className={buttonVariants({ variant: 'secondary' })}>Volver a entregas</Link>}>
        Puede que el enlace sea incorrecto.
      </EmptyState>
    </Card>
  )
}
