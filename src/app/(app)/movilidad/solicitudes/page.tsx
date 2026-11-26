import { Suspense } from 'react'
import { ListPending } from '@/components/list-transition'
import Link from 'next/link'
import { ChevronRight, ClipboardList, SearchX, Wrench } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { VehicleRequestFilters } from '@/components/fleet/vehicle-request-filters'
import { VehicleRequestStatusBadge } from '@/components/fleet/vehicle-request-status-badge'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { applySearch, likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { formatVehicleRequestNumber, openVehicleRequestStatuses, parseVehicleRequestNumber, vehicleLabel, vehicleRequestStatuses, type VehicleRequestStatus } from '@/lib/fleet'
import { formatDate, formatWait, relationOne, waitDays } from '@/lib/requests'
import { requireFleetAccess } from '@/lib/session'

const PATH = '/movilidad/solicitudes'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  // Sin valor: abiertas (pendientes y en compras).
  estado: z.enum([...vehicleRequestStatuses, 'todas']).optional().catch(undefined),
  vehiculo: z.string().uuid().optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref(PATH, { buscar: filters.buscar, estado: filters.estado, vehiculo: filters.vehiculo, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

type VehicleOption = { id: string; label: string }

export default async function VehicleRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireFleetAccess()
  const filters = filtersSchema.parse(await searchParams)
  // Todos los vehículos, también los inactivos: sus solicitudes viejas se siguen consultando.
  const { data } = await supabase.from('vehicles').select('id, name, plate, internal_code').order('internal_code', { nullsFirst: false }).order('name')
  const vehicles: VehicleOption[] = (data ?? []).map((vehicle) => ({ id: vehicle.id as string, label: vehicleLabel(vehicle as { name: string; plate: string; internal_code: string | null }) }))

  return (
    <>
      <BackButton fallback="/movilidad" />
      <PageHeader
        title="Solicitudes de servicio"
        description="Pedidos de mantenimiento y reparación de los vehículos."
        actions={<Link href="/movilidad/solicitudes/nueva" className={buttonVariants()}><Wrench />Pedir reparación</Link>}
      />
      <VehicleRequestFilters buscar={filters.buscar} estado={filters.estado} vehiculo={filters.vehiculo} vehicles={vehicles} />
      <Card>
        <ListPending><Suspense fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <RequestsList filters={filters} />
        </Suspense></ListPending>
      </Card>
    </>
  )
}

type VehicleRelation = { name: string; plate: string; internal_code: string | null }
type RequestRow = { id: string; number: number; description: string; createdAt: string; status: VehicleRequestStatus; vehicle: string; requirement: string | null }

async function RequestsList({ filters }: { filters: Filters }) {
  const { supabase } = await requireFleetAccess()
  let query = supabase.from('vehicle_requests')
    .select('id, request_number, description, created_at, purchase_requirement_number, status:vehicle_request_status, vehicle:vehicles(name, plate, internal_code)', { count: 'exact' })
  if (!filters.estado) query = query.in('vehicle_request_status', openVehicleRequestStatuses)
  else if (filters.estado !== 'todas') query = query.eq('vehicle_request_status', filters.estado)
  if (filters.vehiculo) query = query.eq('vehicle_id', filters.vehiculo)
  // Un número solo busca por número de solicitud o de requerimiento; el resto, por texto.
  const term = filters.buscar?.trim() ?? ''
  const number = term ? parseVehicleRequestNumber(term) : null
  if (number !== null && /^\d+$/.test(term)) query = query.or(`request_number.eq.${number},purchase_requirement_number.ilike.${likeContains(term)}`)
  else if (number !== null) query = query.eq('request_number', number)
  else query = applySearch(query, 'vehicle_request_search_text', searchTokens(term).map((token) => [token]))
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las solicitudes" />

  const rows: RequestRow[] = (data ?? []).map((request) => {
    const vehicle = relationOne(request.vehicle as VehicleRelation | VehicleRelation[] | null)
    return {
      id: request.id as string,
      number: request.request_number as number,
      description: request.description as string,
      createdAt: request.created_at as string,
      status: request.status as VehicleRequestStatus,
      vehicle: vehicle ? vehicleLabel(vehicle) : '—',
      requirement: request.purchase_requirement_number as string | null,
    }
  })
  const total = count ?? 0

  if (rows.length === 0) {
    return filters.buscar || filters.estado || filters.vehiculo || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos solicitudes">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={ClipboardList} title="No hay solicitudes abiertas" action={<Link href="/movilidad/solicitudes/nueva" className={buttonVariants()}><Wrench />Pedir reparación</Link>}>Las solicitudes completadas y canceladas se ven eligiendo otro estado.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5">
        <MobileList>
          {rows.map((row) => (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`${PATH}/${row.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold text-foreground">{formatVehicleRequestNumber(row.number)}</span>
                    <VehicleRequestStatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 truncate text-sm">{row.description}</p>
                  <p className="mt-1 text-xs leading-4 break-words text-foreground-secondary">{[row.vehicle, formatDate(row.createdAt)].join(' · ')}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          ))}
        </MobileList>
        <Table containerClassName="hidden md:block" className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Número</TableHead>
              <TableHead className="w-64">Vehículo</TableHead>
              <TableHead>Problema</TableHead>
              <TableHead className="w-36">Estado</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24 text-right">Espera</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell><Link href={`${PATH}/${row.id}`} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">{formatVehicleRequestNumber(row.number)}</Link></TableCell>
                <TableCell className="truncate">{row.vehicle}</TableCell>
                <TableCell className="truncate" title={row.description}>{row.description}</TableCell>
                <TableCell>
                  <VehicleRequestStatusBadge status={row.status} />
                  {row.requirement && <span className="mt-1 block text-xs text-foreground-secondary tabular-nums">Req. {row.requirement}</span>}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(row.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{openVehicleRequestStatuses.includes(row.status) ? formatWait(waitDays(row.createdAt)) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter divided>
        <ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun={total === 1 ? 'solicitud' : 'solicitudes'} hrefFor={(page) => pageHref(filters, page)} />
      </CardFooter>
    </>
  )
}
