import { Suspense } from 'react'
import Link from 'next/link'
import { Car, ChevronRight, ClipboardList, Plus, SearchX, Wrench } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { VehicleFilters } from '@/components/fleet/vehicle-filters'
import { FormError } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { feedbackMessage } from '@/lib/feedback'
import { applySearch, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { requireFleetAccess } from '@/lib/session'

const PATH = '/movilidad'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  // Sin valor: activos.
  estado: z.enum(['inactivos', 'todos']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref(PATH, { buscar: filters.buscar, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function FleetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { role } = await requireFleetAccess()
  const params = await searchParams
  const filters = filtersSchema.parse(params)
  const isAdmin = role === 'admin'

  return (
    <>
      <PageHeader
        title="Movilidad"
        description="Vehículos de Salud, su historial de mantenimientos y reparaciones, y las solicitudes de servicio."
        actions={(
          <div className="flex flex-wrap gap-3 max-sm:[&>*]:flex-1">
            <Link href="/movilidad/solicitudes" className={buttonVariants({ variant: 'secondary' })}><ClipboardList />Solicitudes de servicio</Link>
            <Link href="/movilidad/solicitudes/nueva" className={buttonVariants({ variant: isAdmin ? 'secondary' : 'default' })}><Wrench />Pedir reparación</Link>
            {isAdmin && <Link href="/movilidad/vehiculos/nuevo" className={buttonVariants()}><Plus />Nuevo vehículo</Link>}
          </div>
        )}
      />
      {feedbackMessage(params.error) && <div className="mb-6"><FormError>{feedbackMessage(params.error)}</FormError></div>}
      <VehicleFilters buscar={filters.buscar} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <VehiclesList filters={filters} isAdmin={isAdmin} />
        </Suspense>
      </Card>
    </>
  )
}

type VehicleRow = { id: string; name: string; brand: string; model: string; year: number; plate: string; internalCode: string | null; active: boolean; openRequests: number }

async function VehiclesList({ filters, isAdmin }: { filters: Filters; isAdmin: boolean }) {
  const { supabase } = await requireFleetAccess()
  let query = supabase.from('vehicles').select('id, name, brand, model, year, plate, internal_code, active, open_requests:vehicle_open_requests', { count: 'exact' })
  if (filters.estado !== 'todos') query = query.eq('active', filters.estado !== 'inactivos')
  // Cada palabra debe aparecer en identificador, nombre, marca, modelo o dominio (vehicle_search_text).
  query = applySearch(query, 'vehicle_search_text', searchTokens(filters.buscar ?? '').map((token) => [token]))
  const { data, count, error } = await query.order('internal_code', { nullsFirst: false }).order('name').range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar los vehículos" />

  const rows: VehicleRow[] = (data ?? []).map((vehicle) => ({
    id: vehicle.id as string,
    name: vehicle.name as string,
    brand: vehicle.brand as string,
    model: vehicle.model as string,
    year: vehicle.year as number,
    plate: vehicle.plate as string,
    internalCode: vehicle.internal_code as string | null,
    active: vehicle.active as boolean,
    openRequests: vehicle.open_requests as number,
  }))
  const total = count ?? 0

  if (rows.length === 0) {
    return filters.buscar || filters.estado || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos vehículos">Probá modificando los filtros aplicados.</EmptyState>
      : (
        <EmptyState icon={Car} title="No hay vehículos cargados" action={isAdmin ? <Link href="/movilidad/vehiculos/nuevo" className={buttonVariants()}><Plus />Nuevo vehículo</Link> : undefined}>
          {isAdmin ? 'Cargá los vehículos de la flota para registrar su historial y pedir reparaciones.' : 'El administrador tiene que cargar los vehículos de la flota.'}
        </EmptyState>
      )
  }

  return (
    <>
      <CardContent className="pt-5">
        <MobileList>
          {rows.map((row) => (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/movilidad/vehiculos/${row.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold break-words text-foreground">{row.internalCode ?? row.name}</span>
                    {!row.active && <ProductStatusBadge active={false} />}
                    <OpenRequestsBadge count={row.openRequests} />
                  </div>
                  <p className="mt-1 text-xs leading-4 break-words text-foreground-secondary">{[row.internalCode && row.name, `${row.brand} ${row.model}`, row.year, row.plate].filter(Boolean).join(' · ')}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          ))}
        </MobileList>
        <Table containerClassName="hidden md:block">
          <TableHeader>
            <TableRow>
              <TableHead>Identificador</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead className="text-right">Año</TableHead>
              <TableHead>Dominio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">{row.internalCode ?? '—'}</TableCell>
                <TableCell>
                  <span className="block">{row.name}</span>
                  <span className="text-xs text-foreground-secondary">{row.brand} {row.model}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.year}</TableCell>
                <TableCell className="font-medium tabular-nums">{row.plate}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <ProductStatusBadge active={row.active} />
                    <OpenRequestsBadge count={row.openRequests} />
                  </div>
                </TableCell>
                <TableCell className="text-right"><Link href={`/movilidad/vehiculos/${row.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver ficha</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter divided>
        <ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun={total === 1 ? 'vehículo' : 'vehículos'} hrefFor={(page) => pageHref(filters, page)} />
      </CardFooter>
    </>
  )
}

function OpenRequestsBadge({ count }: { count: number }) {
  if (count === 0) return null
  return <Badge variant="warning"><Wrench aria-hidden />{count === 1 ? '1 solicitud abierta' : `${count} solicitudes abiertas`}</Badge>
}
