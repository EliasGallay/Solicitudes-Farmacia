import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PackageCheck, Printer } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { ReceiptForm, type ReceiptGroup } from '@/components/requests/receipt-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDeliveryNumber, formatRequestNumber, relationOne } from '@/lib/requests'
import { requireSession } from '@/lib/session'

type ProductRelation = { name: string; presentation: string } | { name: string; presentation: string }[] | null
type LineRow = { id: string; current_quantity: number; status: string; receipt: { id: string } | { id: string }[] | null; request_item: { product: ProductRelation } | { product: ProductRelation }[] | null }

// Confirmación de recepción (solicitante): las líneas de entregas activas que nadie del centro
// confirmó todavía, agrupadas por remito.
export default async function ConfirmReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, role } = await requireSession()
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return <><BackButton fallback="/solicitudes" /><Card><ErrorState title="No encontramos la solicitud" /></Card></>
  const detailHref = `/solicitudes/${id.data}`
  // El admin no confirma recepciones: las confirma el centro.
  if (role !== 'requester') redirect(detailHref)

  const [{ data: request, error }, { data: deliveries, error: deliveriesError }] = await Promise.all([
    supabase.from('requests').select('id, request_number').eq('id', id.data).maybeSingle(),
    supabase.from('deliveries').select('id, delivery_number, created_at, delivery_items(id, current_quantity, status, receipt:delivery_item_receipts(id), request_item:request_items(product:products(name, presentation)))').eq('request_id', id.data).is('voided_at', null).order('created_at'),
  ])
  if (error || deliveriesError || !request) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>

  const groups: ReceiptGroup[] = (deliveries ?? []).map((delivery) => ({
    deliveryId: delivery.id as string,
    number: delivery.delivery_number as number,
    createdAt: delivery.created_at as string,
    lines: ((delivery.delivery_items ?? []) as LineRow[])
      .filter((line) => line.status === 'active' && !relationOne(line.receipt))
      .map((line) => {
        const product = relationOne(relationOne(line.request_item)?.product ?? null)
        return { id: line.id, name: product?.name ?? 'Producto no disponible', presentation: product?.presentation ?? '—', delivered: line.current_quantity }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  })).filter((group) => group.lines.length > 0)

  // Entregas con alguna línea ya confirmada: tienen constancia de recepción para imprimir.
  const printable = (deliveries ?? [])
    .filter((delivery) => ((delivery.delivery_items ?? []) as LineRow[]).some((line) => line.status === 'active' && relationOne(line.receipt)))
    .map((delivery) => ({ id: delivery.id as string, number: delivery.delivery_number as number }))

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title="Confirmar recepción"
        description={<>Solicitud <Link href={detailHref} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(request.request_number as number)}</Link>. La solicitud queda recibida cuando todo lo entregado está confirmado.</>}
      />
      <Card>
        {groups.length === 0
          ? <EmptyState icon={PackageCheck} title="No hay entregas para confirmar" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>Todo lo entregado ya fue confirmado.</EmptyState>
          : <CardContent className="pt-5"><ReceiptForm requestId={id.data} groups={groups} cancelHref={detailHref} /></CardContent>}
      </Card>
      {printable.length > 0 && (
        <Card className="mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 text-sm">
            <Printer className="size-5 shrink-0 text-primary-600" aria-hidden />
            <span>Constancia de lo que ya confirmaste como recibido, para imprimir y firmar.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {printable.map((delivery) => (
              <Link key={delivery.id} href={`/recepciones/${delivery.id}`} target="_blank" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                <Printer />Imprimir {formatDeliveryNumber(delivery.number)}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
