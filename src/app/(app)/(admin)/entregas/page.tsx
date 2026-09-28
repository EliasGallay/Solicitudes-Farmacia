import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, SearchX, Truck } from 'lucide-react'
import { z } from 'zod'
import { CenterBadge, centerRowTones } from '@/components/center-badge'
import { DeliveryFilters } from '@/components/deliveries/delivery-filters'
import { DeliveryStatusBadge, ReceiptStateBadge } from '@/components/deliveries/delivery-status-badge'
import { receiptState, type ReceiptState } from '@/lib/deliveries'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { areaName, getAreas, selectedArea, type Area } from '@/lib/areas'
import { centerTone, getCenters, type Center } from '@/lib/centers'
import { keyParamSchema, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema } from '@/lib/filters'
import { formatDateTime, formatDeliveryNumber, formatRequestNumber, parseDeliveryNumber, parseRequestNumber, relationOne, shiftDate } from '@/lib/requests'
import { requireRole } from '@/lib/session'
import { cn } from '@/lib/utils'

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'
const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined)

const filtersSchema = z.object({
  buscar: searchParamSchema,
  centro: z.string().uuid().optional().catch(undefined),
  rubro: keyParamSchema,
  estado: z.enum(['activa', 'anulada']).optional().catch(undefined),
  desde: dateParamSchema,
  hasta: dateParamSchema,
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/entregas', { buscar: filters.buscar, centro: filters.centro, rubro: filters.rubro, estado: filters.estado, desde: filters.desde, hasta: filters.hasta, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('admin')
  const filters = filtersSchema.parse(await searchParams)
  const [areas, centers] = await Promise.all([getAreas(true).then((result) => result ?? []), getCenters().then((result) => result ?? [])])
  const multipleAreas = areas.length > 1
  if (!multipleAreas || !selectedArea(areas, filters.rubro)) filters.rubro = undefined
  if (!centers.some((center) => center.id === filters.centro)) filters.centro = undefined

  return (
    <>
      <PageHeader title="Entregas" description="Remitos de todas las entregas registradas. Para registrar una entrega, entrá a la solicitud." />
      <DeliveryFilters areas={multipleAreas ? areas : undefined} centers={centers.map((center) => ({ id: center.id, name: center.name, tone: centerTone(centers, center.id) }))} buscar={filters.buscar} centro={filters.centro} rubro={filters.rubro} estado={filters.estado} desde={filters.desde} hasta={filters.hasta} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <DeliveriesList filters={filters} areas={multipleAreas ? areas : undefined} centers={centers} />
        </Suspense>
      </Card>
    </>
  )
}

type RequestRelation = { id: string; request_number: number; health_center_id: string; area: string }
type DeliveryRow = { id: string; number: number; createdAt: string; createdBy: string; request: RequestRelation | null; products: number; units: number; voided: boolean; receipt: ReceiptState; center: { name: string; tone: number }; area?: string }

async function DeliveriesList({ filters, areas, centers }: { filters: Filters; areas?: Area[]; centers: Center[] }) {
  const { supabase } = await requireRole('admin')
  // requests!inner: los filtros por centro, rubro o número de solicitud se aplican sobre la solicitud.
  let query = supabase.from('deliveries').select('id, delivery_number, created_at, voided_at, creator:profiles!deliveries_created_by_fkey(full_name), request:requests!inner(id, request_number, health_center_id, area), delivery_items(current_quantity, receipt:delivery_item_receipts(received_quantity, comment, resolution))', { count: 'exact' })
  if (filters.buscar) {
    // "SOL-…" busca por solicitud; cualquier otro número, por remito.
    const requestNumber = /sol/i.test(filters.buscar) ? parseRequestNumber(filters.buscar) : null
    const deliveryNumber = requestNumber === null ? parseDeliveryNumber(filters.buscar) : null
    if (requestNumber !== null) query = query.eq('request.request_number', requestNumber)
    else if (deliveryNumber !== null) query = query.eq('delivery_number', deliveryNumber)
    else return <EmptyState icon={SearchX} title="No encontramos entregas">Buscá por número de remito (ej. 15 o REM-15) o de solicitud (ej. SOL-120).</EmptyState>
  }
  if (filters.centro) query = query.eq('request.health_center_id', filters.centro)
  if (filters.rubro) query = query.eq('request.area', filters.rubro)
  if (filters.estado === 'activa') query = query.is('voided_at', null)
  if (filters.estado === 'anulada') query = query.not('voided_at', 'is', null)
  if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00${DAY_OFFSET}`)
  if (filters.hasta) query = query.lt('created_at', `${shiftDate(filters.hasta, 1)}T00:00:00${DAY_OFFSET}`)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las entregas" />

  const rows: DeliveryRow[] = (data ?? []).map((delivery) => {
    const request = relationOne(delivery.request as RequestRelation | RequestRelation[] | null)
    type ReceiptRow = { received_quantity: number; comment: string | null; resolution: 'reenviar' | 'cerrar' | null }
    const lines = (delivery.delivery_items ?? []) as { current_quantity: number; receipt: ReceiptRow | ReceiptRow[] | null }[]
    const centerId = request?.health_center_id ?? ''
    return {
      id: delivery.id as string,
      number: delivery.delivery_number as number,
      createdAt: delivery.created_at as string,
      createdBy: relationOne(delivery.creator as { full_name: string } | { full_name: string }[] | null)?.full_name ?? '—',
      request,
      products: lines.length,
      units: lines.reduce((total, line) => total + line.current_quantity, 0),
      voided: Boolean(delivery.voided_at),
      receipt: receiptState(lines.map((line) => {
        const receipt = relationOne(line.receipt)
        return { quantity: line.current_quantity, receipt: receipt ? { received: receipt.received_quantity, comment: receipt.comment, resolution: receipt.resolution } : null }
      })),
      center: { name: centers.find((center) => center.id === centerId)?.name ?? 'Centro no disponible', tone: centerTone(centers, centerId) },
      area: areas && request ? areaName(areas, request.area) : undefined,
    }
  })
  const total = count ?? 0

  if (rows.length === 0) {
    return filters.buscar || filters.centro || filters.rubro || filters.estado || filters.desde || filters.hasta || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos entregas">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={Truck} title="Todavía no hay entregas" action={<Link href="/solicitudes" className={buttonVariants()}>Ver solicitudes por atender</Link>}>Las entregas se registran desde el detalle de cada solicitud.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5">
        <MobileList>
          {rows.map((row) => (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/entregas/${row.id}`} aria-label={`Ver entrega ${formatDeliveryNumber(row.number)}`} className={cn('-mx-2 flex items-center gap-3 rounded-md py-3 pr-2 pl-4 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500', centerRowTones[row.center.tone])}>
                <div className="min-w-0 flex-1">
                  <CenterBadge name={row.center.name} tone={row.center.tone} className="mb-1.5" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={cn('text-sm leading-5 font-semibold', row.voided && 'text-foreground-secondary line-through')}>{formatDeliveryNumber(row.number)}</span>
                    <DeliveryStatusBadge voided={row.voided} />
                    {!row.voided && <ReceiptStateBadge state={row.receipt} />}
                  </div>
                  <p className="mt-1 text-xs leading-4 text-foreground-secondary">{[row.request && formatRequestNumber(row.request.request_number), row.area, formatDateTime(row.createdAt), `${row.units} ${row.units === 1 ? 'unidad' : 'unidades'}`].filter(Boolean).join(' · ')}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          ))}
        </MobileList>
        <Table containerClassName="hidden md:block">
          <TableHeader>
            <TableRow>
              <TableHead>Remito</TableHead>
              <TableHead>Centro de salud</TableHead>
              <TableHead>Solicitud</TableHead>
              {areas && <TableHead className="hidden lg:table-cell">Rubro</TableHead>}
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="hidden xl:table-cell">Registró</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn('font-semibold whitespace-nowrap', centerRowTones[row.center.tone], row.voided && 'text-foreground-secondary line-through')}>{formatDeliveryNumber(row.number)}</TableCell>
                <TableCell><CenterBadge name={row.center.name} tone={row.center.tone} /></TableCell>
                <TableCell className="whitespace-nowrap">{row.request ? <Link href={`/solicitudes/${row.request.id}`} className="text-primary-600 hover:underline">{formatRequestNumber(row.request.request_number)}</Link> : '—'}</TableCell>
                {areas && <TableCell className="hidden lg:table-cell">{row.area}</TableCell>}
                <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.units}<span className="block text-xs text-foreground-secondary">{row.products} {row.products === 1 ? 'producto' : 'productos'}</span></TableCell>
                <TableCell className="hidden xl:table-cell">{row.createdBy}</TableCell>
                <TableCell><DeliveryStatusBadge voided={row.voided} /></TableCell>
                <TableCell>{row.voided ? <span className="text-foreground-muted">—</span> : <ReceiptStateBadge state={row.receipt} />}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/entregas/${row.id}`} aria-label={`Ver entrega ${formatDeliveryNumber(row.number)}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun="entregas" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
