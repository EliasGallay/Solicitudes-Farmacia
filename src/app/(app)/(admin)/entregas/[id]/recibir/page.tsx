import Link from 'next/link'
import { PackageX } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { ReceiptForm } from '@/components/requests/receipt-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDelivery } from '@/lib/deliveries'
import { formatDeliveryNumber, formatRequestNumber } from '@/lib/requests'
import { requireRole } from '@/lib/session'
import { getSignedNotes } from '@/lib/signed-notes'

// Confirmación de recepción por el admin, con el remito firmado por el centro
// (supabase/migrations/202610230002_signed_delivery_notes.sql): las líneas de esta entrega que el centro
// no confirmó. Si ya están todas confirmadas, solo se adjunta el remito.
export default async function AdminConfirmReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return <><BackButton fallback="/entregas" /><NotFound /></>
  const detailHref = `/entregas/${id.data}`

  const [delivery, notes] = await Promise.all([
    getDelivery(supabase, id.data).catch(() => undefined),
    getSignedNotes(supabase, { deliveryId: id.data }),
  ])
  if (delivery === undefined) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la entrega" /></Card></>
  if (!delivery) return <><BackButton fallback="/entregas" /><NotFound /></>

  if (delivery.voidedAt) {
    return (
      <>
        <BackButton fallback={detailHref} />
        <Card>
          <EmptyState icon={PackageX} title="La entrega está anulada" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la entrega</Link>}>
            Una entrega anulada no tiene recepción ni remito firmado.
          </EmptyState>
        </Card>
      </>
    )
  }

  const lines = delivery.items
    .filter((item) => !item.receipt)
    .map((item) => ({ id: item.id, name: item.name, presentation: item.presentation, delivered: item.quantity }))
  const groups = lines.length > 0 ? [{ deliveryId: delivery.id, number: delivery.number, createdAt: delivery.createdAt, lines }] : []

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title={lines.length > 0 ? 'Confirmar recepción con remito firmado' : 'Adjuntar remito firmado'}
        description={<>Entrega <Link href={detailHref} className="font-semibold text-primary-600 hover:underline">{formatDeliveryNumber(delivery.number)}</Link> · Solicitud <Link href={`/solicitudes/${delivery.request.id}`} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(delivery.request.number)}</Link>{delivery.request.centerName && <> · {delivery.request.centerName}</>}</>}
      />
      <Card>
        <CardHeader>
          <CardTitle>{lines.length > 0 ? 'Productos sin confirmar' : 'Remito firmado'}</CardTitle>
          <CardDescription>
            {lines.length > 0
              ? 'Usalo cuando el centro firmó el remito pero no confirmó en el sistema. Marcá cada producto según lo que dice el remito firmado; queda registrado a tu nombre.'
              : 'El centro ya confirmó todos los productos de esta entrega. Podés adjuntar el remito firmado como constancia.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReceiptForm requestId={delivery.request.id} groups={groups} cancelHref={detailHref} signedNote={{ deliveryId: delivery.id, existing: notes.length }} />
        </CardContent>
      </Card>
    </>
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
