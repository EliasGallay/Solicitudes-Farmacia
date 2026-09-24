import { Suspense } from 'react'
import Link from 'next/link'
import { Clock, FileQuestion, FileText, Package, Truck } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { MetricCard } from '@/components/metric-card'
import { RequestDetailSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { DeliveryProgress } from '@/components/requests/delivery-progress'
import { RequestProductFilters } from '@/components/requests/request-product-filters'
import { RequestProductsTable } from '@/components/requests/request-products-table'
import { RequestsTableSkeleton } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ilikeAny, searchParamSchema } from '@/lib/filters'
import { formatDateTime, formatRequestNumber, relationOne, summarizeItems, type ItemQuantitiesRow } from '@/lib/requests'
import type { ProductType } from '@/lib/product-types'
import type { RequestStatus } from '@/lib/request-status'
import { requireSession } from '@/lib/session'

const productFiltersSchema = z.object({
  buscar: searchParamSchema,
  pendiente: z.enum(['con', 'sin']).optional().catch(undefined),
})
type ProductFilters = z.infer<typeof productFiltersSchema>

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession()
  const id = z.string().uuid().safeParse((await params).id)
  const filters = productFiltersSchema.parse(await searchParams)

  return (
    <>
      <BackButton fallback="/solicitudes" />
      {id.success
        ? <Suspense fallback={<RequestDetailSkeleton />}><RequestDetail id={id.data} filters={filters} /></Suspense>
        : <NotFound />}
    </>
  )
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon={FileQuestion} title="No encontramos la solicitud" action={<Link href="/solicitudes" className={buttonVariants({ variant: 'secondary' })}>Volver a solicitudes</Link>}>
        Puede que no exista o que no pertenezca a tu centro.
      </EmptyState>
    </Card>
  )
}

// Último movimiento e historial no se muestran: dependen de la auditoría (Fase 7).
async function RequestDetail({ id, filters }: { id: string; filters: ProductFilters }) {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.from('requests').select('id, request_number, created_at, request_status, observations, request_items(requested_quantity, delivered_quantity, pending_quantity)').eq('id', id).maybeSingle()
  if (error) return <Card><ErrorState title="No pudimos cargar la solicitud" /></Card>
  if (!data) return <NotFound />

  const summary = summarizeItems((data.request_items ?? []) as ItemQuantitiesRow[])

  const createdAt = data.created_at as string
  return (
    <>
      <PageHeader title={<span className="flex flex-wrap items-center gap-3">Solicitud {formatRequestNumber(data.request_number as number)}<StatusBadge status={data.request_status as RequestStatus} /></span>} description={`Fecha de solicitud: ${formatDateTime(createdAt)}`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Package} value={summary.products} label="Productos solicitados" />
        <MetricCard icon={FileText} value={summary.requested} label="Unidades solicitadas" />
        <MetricCard icon={Truck} value={summary.delivered} label="Unidades entregadas" />
        <MetricCard icon={Clock} value={summary.pending} label="Unidades pendientes" tone="warning" />
      </div>

      <div className="mb-6">
        <DeliveryProgress requested={summary.requested} delivered={summary.delivered} pending={summary.pending} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Productos</CardTitle>
          <RequestProductFilters buscar={filters.buscar} pendiente={filters.pendiente} />
        </CardHeader>
        <CardContent>
          <Suspense key={`${filters.buscar ?? ''}|${filters.pendiente ?? ''}`} fallback={<RequestsTableSkeleton rows={3} />}>
            <RequestProducts requestId={id} filters={filters} />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Observaciones</CardTitle></CardHeader>
        <CardContent>
          {data.observations
            ? <p className="text-sm leading-5 whitespace-pre-wrap text-foreground">{data.observations as string}</p>
            : <p className="text-sm leading-5 text-foreground-secondary">Sin observaciones.</p>}
        </CardContent>
      </Card>
    </>
  )
}

// Filtra en la base: búsqueda sobre products y pendiente vía columnas computadas
// (supabase/migrations/202609240001_request_item_quantities.sql).
type ProductRow = { name: string; presentation: string; product_type: ProductType }

async function RequestProducts({ requestId, filters }: { requestId: string; filters: ProductFilters }) {
  const { supabase } = await requireSession()
  const productEmbed = filters.buscar ? 'product:products!inner(name, presentation, product_type)' : 'product:products(name, presentation, product_type)'
  let query = supabase.from('request_items').select(`id, requested_quantity, delivered_quantity, pending_quantity, item_status, ${productEmbed}`).eq('request_id', requestId)
  if (filters.buscar) query = query.or(ilikeAny(['name', 'presentation'], filters.buscar), { referencedTable: 'product' })
  if (filters.pendiente === 'con') query = query.gt('pending_quantity', 0)
  if (filters.pendiente === 'sin') query = query.eq('pending_quantity', 0)
  const { data, error } = await query.order('id')
  if (error) return <ErrorState title="No pudimos cargar los productos" />

  const items = (data ?? []).map((item) => {
    const product = relationOne(item.product as ProductRow | ProductRow[] | null)
    return {
      id: item.id as string,
      name: product?.name ?? 'Producto no disponible',
      presentation: product?.presentation ?? '—',
      type: product?.product_type ?? null,
      requested: item.requested_quantity as number,
      delivered: item.delivered_quantity as number,
      pending: item.pending_quantity as number,
      status: item.item_status as RequestStatus,
    }
  })
  return <RequestProductsTable items={items} />
}
