import { Suspense } from 'react'
import Link from 'next/link'
import { CircleCheck, FileText, Plus, SearchX } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { RequestFilters } from '@/components/requests/request-filters'
import { RequestsTable, type RequestRow } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { areaName, getAreas, selectedArea, type Area } from '@/lib/areas'
import { centerTone, getCenters, type Center } from '@/lib/centers'
import { INBOX_FILTER, openStatuses, statusViewParamSchema, type RequestStatus, type StatusView } from '@/lib/request-status'
import { keyParamSchema, likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { parseRequestNumber, waitDays } from '@/lib/requests'
import { requireSession } from '@/lib/session'

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'

const filtersSchema = z.object({
  rubro: keyParamSchema,
  centro: z.string().uuid().optional().catch(undefined),
  buscar: searchParamSchema,
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  estado: statusViewParamSchema,
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

// Bandeja del admin: sin ?estado= muestra lo que falta atender (pendientes y parciales); "Todos los
// estados" se pide explícito con ?estado=todos. El solicitante ve todo por defecto.
function statusView(filters: Filters, isAdmin: boolean): StatusView {
  return filters.estado ?? (isAdmin ? 'por_atender' : 'todos')
}

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function pageHref(filters: Filters, page: number) {
  return listHref('/solicitudes', { rubro: filters.rubro, centro: filters.centro, buscar: filters.buscar, desde: filters.desde, hasta: filters.hasta, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { role } = await requireSession()
  const isAdmin = role === 'admin'
  const filters = filtersSchema.parse(await searchParams)
  // El rubro solo se muestra y se filtra cuando el usuario ve más de uno.
  const [areas, centers] = await Promise.all([getAreas().then((result) => result ?? []), isAdmin ? getCenters().then((result) => result ?? []) : null])
  const multipleAreas = areas.length > 1
  if (!multipleAreas || !selectedArea(areas, filters.rubro)) filters.rubro = undefined
  // El centro solo lo ve y lo filtra el admin: el solicitante ve únicamente el suyo.
  if (!centers?.some((center) => center.id === filters.centro)) filters.centro = undefined

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description={isAdmin ? 'Visualizá las solicitudes de insumos de todos los centros de salud.' : 'Visualizá todas tus solicitudes de insumos.'}
        // "Nueva solicitud" está oculta para el admin por ahora.
        actions={isAdmin ? undefined : <Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}
      />
      <RequestFilters inbox={isAdmin} areas={multipleAreas ? areas : undefined} centers={centers?.map((center) => ({ id: center.id, name: center.name, tone: centerTone(centers, center.id) }))} rubro={filters.rubro} centro={filters.centro} buscar={filters.buscar} desde={filters.desde} hasta={filters.hasta} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <RequestsList filters={filters} view={statusView(filters, isAdmin)} areas={multipleAreas ? areas : undefined} centers={centers ?? undefined} />
        </Suspense>
      </Card>
    </>
  )
}

async function RequestsList({ filters, view, areas, centers }: { filters: Filters; view: StatusView; areas?: Area[]; centers?: Center[] }) {
  const { supabase } = await requireSession()
  const inbox = view === 'por_atender'
  // Búsqueda (en la base, columnas de supabase/migrations/202609240006_search.sql):
  // - un número ("2", "#2", "SOL-2") busca por número parcial y ordena ascendente, por lo que la
  //   coincidencia exacta queda primera (todo número que contiene esos dígitos es mayor o igual);
  // - cualquier otro texto busca cada palabra en el número y los productos, sin distinguir acentos.
  const number = filters.buscar ? parseRequestNumber(filters.buscar) : null

  let query = supabase.from('requests').select('id, area, health_center_id, request_number, created_at, request_status, receipt_unconfirmed_count, receipt_discrepancy_count, request_items(count)', { count: 'exact' })
  if (filters.rubro) query = query.eq('area', filters.rubro)
  if (filters.centro) query = query.eq('health_center_id', filters.centro)
  if (number !== null) query = query.ilike('request_number_text', likeContains(String(number)))
  else for (const token of searchTokens(filters.buscar ?? '')) query = query.ilike('request_search_text', likeContains(token))
  if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00${DAY_OFFSET}`)
  // Por atender: con pendiente de entrega o con una diferencia de recepción sin resolver.
  if (inbox) query = query.or(INBOX_FILTER)
  else if (view === 'por_confirmar') query = query.gt('receipt_unconfirmed_count', 0)
  else if (view === 'con_diferencia') query = query.gt('receipt_discrepancy_count', 0)
  else if (view !== 'todos') query = query.eq('request_status', view)
  if (filters.hasta) query = query.lt('created_at', `${nextDay(filters.hasta)}T00:00:00${DAY_OFFSET}`)
  // Por atender: de la más antigua a la más nueva (se atienden por orden de llegada).
  const ordered = number !== null ? query.order('request_number', { ascending: true }) : query.order('created_at', { ascending: inbox })
  const { data, count, error } = await ordered.range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las solicitudes" />

  const now = Date.now()
  const rows: RequestRow[] = (data ?? []).map((request) => {
    const centerId = request.health_center_id as string
    const center = centers?.find((option) => option.id === centerId)
    const status = request.request_status as RequestStatus
    return {
      id: request.id as string,
      number: request.request_number as number,
      createdAt: request.created_at as string,
      productCount: (request.request_items as { count: number }[] | null)?.[0]?.count ?? 0,
      status,
      area: areas ? areaName(areas, request.area as string) : undefined,
      center: centers ? { name: center?.name ?? 'Centro no disponible', tone: centerTone(centers, centerId) } : undefined,
      // Espera: solo para el admin y solo mientras la solicitud tenga algo pendiente.
      waitDays: centers && openStatuses.includes(status) ? waitDays(request.created_at as string, now) : undefined,
      unconfirmed: (request.receipt_unconfirmed_count as number) > 0,
      discrepancy: (request.receipt_discrepancy_count as number) > 0,
    }
  })
  const total = count ?? 0
  const hasFilters = Boolean(filters.rubro || filters.centro || filters.buscar || filters.desde || filters.hasta || filters.estado)

  if (rows.length === 0) {
    if (inbox && !hasFilters && total === 0) {
      return <EmptyState icon={CircleCheck} title="No hay solicitudes por atender" action={<Link href={listHref('/solicitudes', { estado: 'todos' })} className={buttonVariants({ variant: 'secondary' })}>Ver todas las solicitudes</Link>}>Todas las solicitudes están entregadas o cerradas.</EmptyState>
    }
    return hasFilters || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos solicitudes">Probá modificando los filtros aplicados.</EmptyState>
      : centers
        ? <EmptyState icon={FileText} title="Todavía no hay solicitudes">Cuando los centros de salud realicen solicitudes aparecerán en este listado.</EmptyState>
        : <EmptyState icon={FileText} title="Todavía no hay solicitudes" action={<Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}>Cuando realices una solicitud aparecerá en este listado.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5"><RequestsTable rows={rows} /></CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun="solicitudes" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
