import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PackageCheck } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { ReceiptForm, type ReceiptGroup } from '@/components/requests/receipt-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatRequestNumber, relationOne } from '@/lib/requests'
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
    </>
  )
}
