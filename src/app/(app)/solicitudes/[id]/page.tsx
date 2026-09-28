import { Suspense } from 'react'
import Link from 'next/link'
import { Ban, CircleUser, Clock, FileQuestion, FileText, Package, PackageCheck, PackageX, Printer, TriangleAlert, Truck } from 'lucide-react'
import { z } from 'zod'
import { cancelRequest } from '@/app/request-management-actions'
import { BackButton } from '@/components/back-button'
import { CenterBadge } from '@/components/center-badge'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { MetricCard } from '@/components/metric-card'
import { RequestDetailSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { DeliveryProgress } from '@/components/requests/delivery-progress'
import { ReceiptDifferences, RequestHistory, UNKNOWN_ACTOR, type ClosureEvent, type DeliverySummary, type OpenDifference, type ReceiptEvent, type ResolutionEvent } from '@/components/requests/request-activity'
import { RequestProductFilters } from '@/components/requests/request-product-filters'
import { RequestProductsTable } from '@/components/requests/request-products-table'
import { RequestsTableSkeleton } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { areaName, getAreas } from '@/lib/areas'
import { centerTone, getCenters } from '@/lib/centers'
import { feedbackMessage } from '@/lib/feedback'
import type { ClosureReason, ReceiptResolution } from '@/lib/request-management'
import { formatDateTime, formatDeliveryNumber, formatRequestNumber, relationOne, summarizeItems, type ItemQuantitiesRow } from '@/lib/requests'
import { productTypeLabel, type ProductTypeRelation } from '@/lib/product-types'
import type { RequestStatus } from '@/lib/request-status'
import { requireSession } from '@/lib/session'

const productFiltersSchema = z.object({
  buscar: searchParamSchema,
  pendiente: z.enum(['con', 'sin']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type ProductFilters = z.infer<typeof productFiltersSchema>

// Error de una operación de gestión (?error=) y remito recién creado (?remito=). Los éxitos (?success=)
// los muestra SuccessToast.
const feedbackSchema = z.object({
  error: z.string().optional(),
  remito: z.string().uuid().optional().catch(undefined),
})
type Feedback = z.infer<typeof feedbackSchema>

export default async function RequestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession()
  const id = z.string().uuid().safeParse((await params).id)
  const query = await searchParams
  const filters = productFiltersSchema.parse(query)
  const feedback = feedbackSchema.parse(query)

  return (
    <>
      <BackButton fallback="/solicitudes" />
      {id.success
        ? <Suspense fallback={<RequestDetailSkeleton />}><RequestDetail id={id.data} filters={filters} feedback={feedback} /></Suspense>
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

async function RequestDetail({ id, filters, feedback }: { id: string; filters: ProductFilters; feedback: Feedback }) {
  const { supabase, role, userId } = await requireSession()
  const isAdmin = role === 'admin'
  const [areas, centers, { data, error }, { data: deliveryRows, error: deliveriesError }, { data: closureRows, error: closuresError }, { data: receiptRows, error: receiptsError }, { data: actorRows }] = await Promise.all([
    getAreas().then((result) => result ?? []),
    // El centro solo se muestra al admin: el solicitante ve únicamente las de su centro.
    isAdmin ? getCenters().then((result) => result ?? []) : null,
    supabase.from('requests').select('id, area, health_center_id, request_number, created_at, created_by, request_status, observations, request_items(requested_quantity, delivered_quantity, pending_quantity, closed_quantity)').eq('id', id).maybeSingle(),
    supabase.from('deliveries').select('id, delivery_number, created_at, created_by, note, voided_at, voided_by, void_reason, delivery_items(id, current_quantity, request_item:request_items(product:products(name)))').eq('request_id', id).order('created_at'),
    supabase.from('request_item_closures').select('quantity, reason, detail, created_at, created_by, request_item:request_items(product:products(name))').eq('request_id', id).order('created_at'),
    // Recepciones del centro, línea por línea (supabase/migrations/202610040001_delivery_receipts.sql).
    supabase.from('delivery_item_receipts').select('id, delivery_item_id, delivered_quantity, received_quantity, comment, created_by, created_at, resolution, resolution_note, resolved_by, resolved_at').eq('request_id', id).order('created_at'),
    // Nombres de todos los que actuaron sobre la solicitud. Por RLS de profiles el solicitante solo lee
    // su propio perfil; esta RPC le devuelve solo el nombre de sus compañeros y del admin
    // (supabase/migrations/202610030001_request_actor_names.sql).
    supabase.rpc('request_actor_names', { target_request_id: id }),
  ])
  // Entregas, cierres y recepciones definen acciones y avisos: si alguna falla no se muestra un
  // estado parcial (p. ej. todo como "sin confirmar").
  if (error || deliveriesError || closuresError || receiptsError) {
    console.error('Error al cargar la solicitud', error ?? deliveriesError ?? closuresError ?? receiptsError)
    return <Card><ErrorState title="No pudimos cargar la solicitud" /></Card>
  }
  if (!data) return <NotFound />

  const names = new Map(((actorRows ?? []) as { user_id: string; full_name: string }[]).map((actor) => [actor.user_id, actor.full_name]))
  const actorName = (actorId: string | null) => (actorId && names.get(actorId)) || UNKNOWN_ACTOR

  const summary = summarizeItems((data.request_items ?? []) as ItemQuantitiesRow[])
  const status = data.request_status as RequestStatus

  const createdAt = data.created_at as string
  const createdBy = data.created_by as string
  const creatorName = names.get(createdBy)
  const centerId = data.health_center_id as string
  const center = centers && { name: centers.find((option) => option.id === centerId)?.name ?? 'Centro no disponible', tone: centerTone(centers, centerId) }

  type ProductName = { name: string } | { name: string }[] | null
  type LineRow = { id: string; current_quantity: number; request_item: { product: ProductName } | { product: ProductName }[] | null }
  const receiptsList = (receiptRows ?? []) as { id: string; delivery_item_id: string; delivered_quantity: number; received_quantity: number; comment: string | null; created_by: string; created_at: string; resolution: ReceiptResolution | null; resolution_note: string | null; resolved_by: string | null; resolved_at: string | null }[]
  const confirmedLines = new Set(receiptsList.map((receipt) => receipt.delivery_item_id))

  // Líneas entregadas, con su producto y remito, para describir recepciones y diferencias.
  const lineInfo = new Map<string, { name: string; deliveryNumber: number; active: boolean }>()
  const deliveries: DeliverySummary[] = (deliveryRows ?? []).map((row) => {
    const lines = (row.delivery_items ?? []) as LineRow[]
    for (const line of lines) {
      const name = relationOne(relationOne(line.request_item)?.product ?? null)?.name ?? 'Producto no disponible'
      lineInfo.set(line.id, { name, deliveryNumber: row.delivery_number as number, active: !row.voided_at })
    }
    return {
      id: row.id as string,
      number: row.delivery_number as number,
      createdAt: row.created_at as string,
      createdBy: actorName(row.created_by as string),
      units: lines.reduce((total, line) => total + line.current_quantity, 0),
      products: lines.length,
      note: row.note as string | null,
      voidedAt: row.voided_at as string | null,
      voidedBy: row.voided_at ? actorName(row.voided_by as string | null) : null,
      voidReason: row.void_reason as string | null,
      confirmed: lines.some((line) => confirmedLines.has(line.id)),
    }
  })
  // Líneas de entregas activas que el centro todavía no confirmó.
  const unconfirmedLines = [...lineInfo.entries()].filter(([lineId, info]) => info.active && !confirmedLines.has(lineId)).length

  // Una confirmación inserta una fila por línea con la misma fecha y autor: se agrupan.
  const receiptEvents = new Map<string, ReceiptEvent>()
  const resolutions: ResolutionEvent[] = []
  const openDifferences: OpenDifference[] = []
  for (const receipt of receiptsList) {
    const info = lineInfo.get(receipt.delivery_item_id)
    const name = info?.name ?? 'Producto no disponible'
    const key = `${receipt.created_at}|${receipt.created_by}`
    const event = receiptEvents.get(key) ?? { at: receipt.created_at, by: actorName(receipt.created_by), lines: [] }
    event.lines.push({ name, delivered: receipt.delivered_quantity, received: receipt.received_quantity, comment: receipt.comment })
    receiptEvents.set(key, event)

    if (receipt.resolution && receipt.resolved_at) {
      resolutions.push({ at: receipt.resolved_at, by: actorName(receipt.resolved_by), resolution: receipt.resolution, note: receipt.resolution_note, name, missing: receipt.delivered_quantity - receipt.received_quantity })
    } else if (receipt.received_quantity < receipt.delivered_quantity && info?.active) {
      openDifferences.push({ receiptId: receipt.id, name, deliveryNumber: info.deliveryNumber, delivered: receipt.delivered_quantity, received: receipt.received_quantity, comment: receipt.comment, by: actorName(receipt.created_by), at: receipt.created_at })
    }
  }

  // Una operación de cierre inserta una fila por producto con la misma fecha y motivo: se agrupan.
  // Los cierres 'no_recibido' ya se muestran como resolución de la diferencia.
  const closures = new Map<string, ClosureEvent>()
  for (const row of closureRows ?? []) {
    if (row.reason === 'no_recibido') continue
    const key = `${row.created_at}|${row.reason}|${row.created_by}`
    const productName = relationOne(relationOne(row.request_item as { product: { name: string } | { name: string }[] | null } | { product: { name: string } | { name: string }[] | null }[] | null)?.product ?? null)?.name ?? 'Producto no disponible'
    const event = closures.get(key) ?? { at: row.created_at as string, by: actorName(row.created_by as string), reason: row.reason as ClosureReason, detail: row.detail as string | null, products: [] }
    event.products.push({ name: productName, quantity: row.quantity as number })
    closures.set(key, event)
  }

  const newDelivery = feedback.remito ? deliveries.find((delivery) => delivery.id === feedback.remito && !delivery.voidedAt) : undefined
  // El solicitante puede cancelar mientras nada se haya entregado (la base lo vuelve a validar).
  const canCancel = role === 'requester' && summary.pending > 0 && summary.delivered === 0
  // Cualquier solicitante del centro confirma lo que llegó (la base lo vuelve a validar).
  const canConfirm = role === 'requester' && unconfirmedLines > 0

  const actions = isAdmin && summary.pending > 0
    ? (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/solicitudes/${id}/cerrar`} className={buttonVariants({ variant: 'secondary' })}><PackageX />Cerrar pendiente</Link>
        <Link href={`/solicitudes/${id}/entregar`} className={buttonVariants()}><Truck />Registrar entrega</Link>
      </div>
    )
    : canConfirm
      ? <Link href={`/solicitudes/${id}/recibir`} className={buttonVariants()}><PackageCheck />Confirmar recepción</Link>
      : canCancel
        ? (
          <form action={cancelRequest}>
            <input type="hidden" name="request_id" value={id} />
            <ConfirmSubmit variant="secondary" className="w-full sm:w-auto" tone="destructive" title="Cancelar la solicitud" description="No se va a entregar ningún producto y no se puede deshacer. Si necesitás algo, vas a tener que hacer una solicitud nueva." confirmLabel="Cancelar solicitud">
              <Ban />Cancelar solicitud
            </ConfirmSubmit>
          </form>
        )
        : undefined

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Solicitud {formatRequestNumber(data.request_number as number)}<StatusBadge status={status} />{center && <CenterBadge name={center.name} tone={center.tone} className="text-sm" />}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Fecha de solicitud: {formatDateTime(createdAt)}</span>
            {creatorName && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1.5">
                  <CircleUser className="size-4 shrink-0" aria-hidden />
                  Solicitado por:{' '}
                  {/* El admin puede ir a la ficha del usuario. */}
                  {isAdmin
                    ? <Link href={`/usuarios/${createdBy}`} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">{creatorName}</Link>
                    : <span className="font-semibold text-foreground">{creatorName}{createdBy === userId && ' (vos)'}</span>}
                </span>
              </>
            )}
            {/* El rubro solo se muestra cuando el usuario ve más de uno. */}
            {areas.length > 1 && <><span aria-hidden>·</span><span>Rubro: {areaName(areas, data.area as string)}</span></>}
          </span>
        }
        actions={actions}
      />

      {feedbackMessage(feedback.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedback.error)}</FormError></div>}
      {/* Entrega recién registrada (?remito=): el mensaje sale como toast; acá queda el acceso al remito. */}
      {isAdmin && newDelivery && (
        <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 text-sm">
            <Printer className="size-5 shrink-0 text-primary-600" aria-hidden />
            <span>El remito <span className="font-semibold">{formatDeliveryNumber(newDelivery.number)}</span> está listo para imprimir.</span>
          </p>
          <Link href={`/remitos/${newDelivery.id}`} target="_blank" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}><Printer />Imprimir remito</Link>
        </Card>
      )}

      {canConfirm && (
        <Card className="mb-6 flex flex-col gap-3 border-primary-500 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex gap-3 text-sm">
            <PackageCheck className="size-5 shrink-0 text-primary-600" aria-hidden />
            <div>
              <p className="font-semibold">{unconfirmedLines === 1 ? 'Falta confirmar la recepción de 1 producto.' : `Falta confirmar la recepción de ${unconfirmedLines} productos.`}</p>
              <p className="mt-1 text-foreground-secondary">La solicitud se da por recibida cuando se confirma todo lo entregado.</p>
            </div>
          </div>
          <Link href={`/solicitudes/${id}/recibir`} className={buttonVariants({ className: 'shrink-0' })}>Confirmar recepción</Link>
        </Card>
      )}
      {role === 'requester' && !canConfirm && openDifferences.length > 0 && (
        <Card className="mb-6 flex gap-3 border-warning bg-warning-muted/40 p-4 text-sm sm:p-5">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <p><span className="font-semibold">Se informaron diferencias en {openDifferences.length === 1 ? '1 producto' : `${openDifferences.length} productos`}.</span> La administración las está revisando; la solicitud se dará por recibida cuando se resuelvan.</p>
        </Card>
      )}
      {isAdmin && <ReceiptDifferences requestId={id} differences={openDifferences} />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard icon={Package} value={summary.products} label="Productos solicitados" />
        <MetricCard icon={FileText} value={summary.requested} label="Unidades solicitadas" />
        <MetricCard icon={Truck} value={summary.delivered} label="Unidades entregadas" />
        <MetricCard icon={Clock} value={summary.pending} label="Unidades pendientes" tone="warning" />
      </div>

      <div className="mb-6">
        <DeliveryProgress requested={summary.requested} delivered={summary.delivered} pending={summary.pending} />
        {summary.closed > 0 && <p className="mt-2 text-sm text-foreground-secondary">{summary.closed} {summary.closed === 1 ? 'unidad cerrada' : 'unidades cerradas'} sin entregar (ver historial).</p>}
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 sm:gap-4">
          <CardTitle>Productos</CardTitle>
          <RequestProductFilters buscar={filters.buscar} pendiente={filters.pendiente} />
        </CardHeader>
        <Suspense key={productsHref(id, filters, filters.page)} fallback={<CardContent><RequestsTableSkeleton rows={3} /></CardContent>}>
          <RequestProducts requestId={id} filters={filters} />
        </Suspense>
      </Card>

      <RequestHistory requestId={id} isAdmin={isAdmin} createdAt={createdAt} createdBy={actorName(createdBy)} deliveries={deliveries} closures={[...closures.values()]} receipts={[...receiptEvents.values()]} resolutions={resolutions} />

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
type ProductRow = { name: string; presentation: string; type: ProductTypeRelation }

function productsHref(requestId: string, filters: ProductFilters, page: number) {
  return listHref(`/solicitudes/${requestId}`, { buscar: filters.buscar, pendiente: filters.pendiente, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

async function RequestProducts({ requestId, filters }: { requestId: string; filters: ProductFilters }) {
  const { supabase } = await requireSession()
  let query = supabase.from('request_items').select(`id, requested_quantity, delivered_quantity, closed_quantity, pending_quantity, item_status, product:products(name, presentation, type:product_types(label))`, { count: 'exact' }).eq('request_id', requestId)
  // Búsqueda sobre item_search_text (producto normalizado): todas las palabras deben coincidir.
  for (const token of searchTokens(filters.buscar ?? '')) query = query.ilike('item_search_text', likeContains(token))
  if (filters.pendiente === 'con') query = query.gt('pending_quantity', 0)
  if (filters.pendiente === 'sin') query = query.eq('pending_quantity', 0)
  const { data, count, error } = await query.order('id').range(...pageRange(filters.page, filters.por_pagina))
  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar los productos" />

  const items = (data ?? []).map((item) => {
    const product = relationOne(item.product as ProductRow | ProductRow[] | null)
    return {
      id: item.id as string,
      name: product?.name ?? 'Producto no disponible',
      presentation: product?.presentation ?? '—',
      type: product ? productTypeLabel(product.type) : null,
      requested: item.requested_quantity as number,
      delivered: item.delivered_quantity as number,
      closed: item.closed_quantity as number,
      pending: item.pending_quantity as number,
      status: item.item_status as RequestStatus,
    }
  })
  return (
    <>
      <CardContent><RequestProductsTable items={items} /></CardContent>
      {items.length > 0 && <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={items.length} total={count ?? 0} noun="productos" hrefFor={(page) => productsHref(requestId, filters, page)} /></CardFooter>}
    </>
  )
}
