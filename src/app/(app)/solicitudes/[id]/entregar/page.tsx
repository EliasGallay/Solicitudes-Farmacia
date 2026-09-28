import Link from 'next/link'
import { PackageCheck } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { CenterBadge } from '@/components/center-badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { DeliveryForm } from '@/components/requests/delivery-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { centerTone, getCenters } from '@/lib/centers'
import { formatRequestNumber, relationOne } from '@/lib/requests'
import { requireRole } from '@/lib/session'

type ItemRow = { id: string; requested_quantity: number; delivered_quantity: number; pending_quantity: number; product: { name: string; presentation: string } | { name: string; presentation: string }[] | null }

export default async function RegisterDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return <><BackButton fallback="/solicitudes" /><Card><ErrorState title="No encontramos la solicitud" /></Card></>
  const detailHref = `/solicitudes/${id.data}`

  const [{ data: request, error }, centers] = await Promise.all([
    supabase.from('requests').select('id, request_number, health_center_id, request_items(id, requested_quantity, delivered_quantity, pending_quantity, product:products(name, presentation))').eq('id', id.data).maybeSingle(),
    getCenters(),
  ])
  if (error || !request) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>

  const items = ((request.request_items ?? []) as ItemRow[])
    .filter((item) => item.pending_quantity > 0)
    .map((item) => {
      const product = relationOne(item.product)
      return { id: item.id, name: product?.name ?? 'Producto no disponible', presentation: product?.presentation ?? '—', requested: item.requested_quantity, delivered: item.delivered_quantity, pending: item.pending_quantity }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const centerId = request.health_center_id as string
  const center = (centers ?? []).find((option) => option.id === centerId)

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Registrar entrega{center && <CenterBadge name={center.name} tone={centerTone(centers ?? [], centerId)} className="text-sm" />}</span>}
        description={<>Solicitud <Link href={detailHref} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(request.request_number as number)}</Link>. Al confirmar se genera el remito.</>}
      />
      <Card>
        {items.length === 0
          ? <EmptyState icon={PackageCheck} title="No hay nada pendiente de entregar" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>Todos los productos se entregaron o se cerraron.</EmptyState>
          : <CardContent className="pt-5"><DeliveryForm requestId={id.data} items={items} cancelHref={detailHref} /></CardContent>}
      </Card>
    </>
  )
}
