import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Package, Plus, SearchX } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { CatalogTabs } from '@/components/products/catalog-tabs'
import { ProductFilters } from '@/components/products/product-filters'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { areaName, getAreas, getProductTypes, selectedArea, type Area } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { keyParamSchema, likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { productTypeLabel, type ProductTypeRelation } from '@/lib/product-types'
import { requireRole } from '@/lib/session'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  rubro: keyParamSchema,
  tipo: keyParamSchema,
  estado: z.enum(['activo', 'inactivo']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/catalogos', { buscar: filters.buscar, rubro: filters.rubro, tipo: filters.tipo, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function CatalogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole('admin')
  const params = await searchParams
  const filters = filtersSchema.parse(params)

  const [allAreas, allTypes] = await Promise.all([getAreas(true), getProductTypes()])
  const areas = allAreas ?? []
  const types = allTypes ?? []

  // Igual que el catálogo del solicitante: con un solo rubro no hay filtro de rubro y el tipo es de
  // ese rubro; con varios, el tipo depende del rubro elegido (las claves pueden repetirse entre rubros).
  const multipleAreas = areas.length > 1
  const area = multipleAreas ? selectedArea(areas, filters.rubro) : areas[0]
  if (!multipleAreas || !area) filters.rubro = undefined
  const filterTypes = area ? types.filter((type) => type.area === area.key) : []
  if (!area) filters.tipo = undefined

  return (
    <>
      <PageHeader
        title="Catálogos"
        description="Administrá los productos disponibles para las solicitudes."
        actions={<Link href="/catalogos/nuevo" className={buttonVariants()}><Plus />Nuevo producto</Link>}
      />
      <CatalogTabs />
      {feedbackMessage(params.error) && <div className="mb-6"><FormError>{feedbackMessage(params.error)}</FormError></div>}
      <ProductFilters areas={multipleAreas ? areas : undefined} rubro={filters.rubro} types={filterTypes} buscar={filters.buscar} tipo={filters.tipo} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <ProductsList filters={filters} areas={multipleAreas ? areas : undefined} />
        </Suspense>
      </Card>
    </>
  )
}

type ProductRow = { id: string; name: string; presentation: string; typeLabel: string; area?: string; active: boolean }

async function ProductsList({ filters, areas }: { filters: Filters; areas?: Area[] }) {
  const { supabase } = await requireRole('admin')
  let query = supabase.from('products').select('id, area, name, presentation, active, type:product_types(label)', { count: 'exact' })
  if (filters.rubro) query = query.eq('area', filters.rubro)
  if (filters.tipo) query = query.eq('product_type', filters.tipo)
  if (filters.estado) query = query.eq('active', filters.estado === 'activo')
  // Cada palabra debe aparecer en nombre o presentación, sin distinguir acentos (product_search_text).
  for (const token of searchTokens(filters.buscar ?? '')) query = query.ilike('product_search_text', likeContains(token))
  const { data, count, error } = await query.order('name').range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar los productos" />

  const rows: ProductRow[] = (data ?? []).map((product) => ({
    id: product.id as string,
    name: product.name as string,
    presentation: product.presentation as string,
    typeLabel: productTypeLabel(product.type as ProductTypeRelation),
    area: areas ? areaName(areas, product.area as string) : undefined,
    active: product.active as boolean,
  }))
  const total = count ?? 0

  if (rows.length === 0) {
    return filters.buscar || filters.rubro || filters.tipo || filters.estado || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos productos">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={Package} title="Todavía no hay productos" action={<Link href="/catalogos/nuevo" className={buttonVariants()}><Plus />Nuevo producto</Link>} />
  }

  return (
    <>
      <CardContent className="pt-5">
        <MobileList>
          {rows.map((row) => (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/catalogos/${row.id}`} aria-label={`Editar ${row.name}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold break-words text-foreground">{row.name}</span>
                    <ProductStatusBadge active={row.active} />
                  </div>
                  <p className="mt-1 text-xs leading-4 break-words text-foreground-secondary">{[row.area, row.typeLabel, row.presentation].filter(Boolean).join(' · ')}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          ))}
        </MobileList>
        <Table containerClassName="hidden md:block">
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              {areas && <TableHead>Rubro</TableHead>}
              <TableHead>Tipo</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">{row.name}</TableCell>
                {areas && <TableCell>{row.area}</TableCell>}
                <TableCell>{row.typeLabel}</TableCell>
                <TableCell className="text-foreground-secondary">{row.presentation}</TableCell>
                <TableCell><ProductStatusBadge active={row.active} /></TableCell>
                <TableCell className="text-right">
                  <Link href={`/catalogos/${row.id}`} aria-label={`Editar ${row.name}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Editar<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun="productos" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
