import Link from 'next/link'
import { Pencil, Plus, SearchX, Tags } from 'lucide-react'
import { z } from 'zod'
import { createProductType, toggleProductType, updateProductType } from '@/app/product-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { PageHeader } from '@/components/page-header'
import { CatalogTabs } from '@/components/products/catalog-tabs'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { ProductTypeFilters } from '@/components/products/product-type-filters'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { areaName, getAreas, selectedArea } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { keySchema, keyParamSchema, listHref, normalizeSearch, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { requireRole } from '@/lib/session'

const PATH = '/catalogos/tipos'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  rubro: keyParamSchema,
  estado: z.enum(['activo', 'inactivo']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

// ?editar=<rubro>.<clave>: el tipo que se está renombrando. Las claves no contienen puntos.
const editingSchema = z.string().transform((value) => value.split('.')).pipe(z.tuple([keySchema, keySchema])).optional().catch(undefined)

function pageHref(filters: Filters, page: number, extra: Record<string, string | undefined> = {}) {
  return listHref(PATH, { buscar: filters.buscar, rubro: filters.rubro, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina), ...extra }, page)
}

type TypeRow = { area: string; key: string; label: string; active: boolean; areaName: string; productCount: number }

export default async function ProductTypesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole('admin')
  const params = await searchParams
  const filters = filtersSchema.parse(params)
  const editing = editingSchema.parse(params.editar)
  const creating = params.nuevo === '1'

  const [{ data, error }, allAreas] = await Promise.all([
    // products(count): productos que usan el tipo (FK compuesta area + product_type), activos o no.
    supabase.from('product_types').select('area, key, label, active, products(count)').order('label'),
    getAreas(true),
  ])
  const areas = allAreas ?? []
  const activeAreas = areas.filter((area) => area.active)
  const multipleAreas = areas.length > 1
  if (!multipleAreas || !selectedArea(areas, filters.rubro)) filters.rubro = undefined

  const tokens = searchTokens(filters.buscar ?? '')
  // Pocos tipos por rubro: se filtran en memoria, con la misma normalización (sin acentos) que el resto de las búsquedas.
  const rows: TypeRow[] = (data ?? [])
    .map((type) => ({
      area: type.area as string,
      key: type.key as string,
      label: type.label as string,
      active: type.active as boolean,
      areaName: areaName(areas, type.area as string),
      productCount: (type.products as { count: number }[] | null)?.[0]?.count ?? 0,
    }))
    .filter((type) => (!filters.rubro || type.area === filters.rubro)
      && (!filters.estado || type.active === (filters.estado === 'activo'))
      && tokens.every((token) => normalizeSearch(type.label).includes(token)))
  const [from, to] = pageRange(filters.page, filters.por_pagina)
  const pageRows = rows.slice(from, to + 1)
  const isEditing = (row: TypeRow) => editing?.[0] === row.area && editing[1] === row.key

  return (
    <>
      <PageHeader
        title="Catálogos"
        description="Administrá los tipos de producto de cada rubro."
        actions={<Link href={listHref(PATH, { nuevo: '1' })} className={buttonVariants()}><Plus />Nuevo tipo</Link>}
      />
      <CatalogTabs />
      {feedbackMessage(params.error) && <div className="mb-6"><FormError>{feedbackMessage(params.error)}</FormError></div>}

      {creating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nuevo tipo</CardTitle>
            <CardDescription>Cada rubro tiene sus propios tipos. El nombre se puede cambiar después.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createProductType} className="grid gap-4 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
              {activeAreas.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tipo-rubro">Rubro</Label>
                  <Select name="area" required defaultValue={filters.rubro && activeAreas.some((area) => area.key === filters.rubro) ? filters.rubro : undefined}>
                    <SelectTrigger id="tipo-rubro" className="sm:w-48"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{activeAreas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : <input type="hidden" name="area" value={activeAreas[0]?.key ?? ''} />}
              <div className="flex flex-col gap-2 sm:col-start-2">
                <Label htmlFor="tipo-nombre">Nombre</Label>
                <Input id="tipo-nombre" name="label" required maxLength={60} placeholder="Ej.: Reactivo" autoFocus />
              </div>
              <Link href={PATH} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
              <Button type="submit">Agregar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <ProductTypeFilters areas={multipleAreas ? areas : undefined} buscar={filters.buscar} rubro={filters.rubro} estado={filters.estado} />
      <Card>
        {error ? <ErrorState title="No pudimos cargar los tipos de producto" />
          : pageRows.length === 0 ? (
            filters.buscar || filters.rubro || filters.estado || rows.length > 0
              ? <EmptyState icon={SearchX} title="No encontramos tipos">Probá modificando los filtros aplicados.</EmptyState>
              : <EmptyState icon={Tags} title="Todavía no hay tipos de producto" action={<Link href={listHref(PATH, { nuevo: '1' })} className={buttonVariants()}><Plus />Nuevo tipo</Link>} />
          ) : (
            <>
              <CardContent className="pt-5">
                <MobileList>
                  {pageRows.map((row) => (
                    <MobileListItem key={`${row.area}.${row.key}`}>
                      {isEditing(row) ? <RenameForm row={row} cancelHref={pageHref(filters, filters.page)} /> : (
                        <>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm leading-5 font-semibold break-words text-foreground">{row.label}</span>
                            <ProductStatusBadge active={row.active} />
                          </div>
                          <p className="mt-1 text-xs leading-4 text-foreground-secondary">{multipleAreas && `${row.areaName} · `}<ProductCount row={row} multipleAreas={multipleAreas} /></p>
                          <div className="mt-2 flex gap-2"><RowActions row={row} editHref={pageHref(filters, filters.page, { editar: `${row.area}.${row.key}` })} /></div>
                        </>
                      )}
                    </MobileListItem>
                  ))}
                </MobileList>
                <Table containerClassName="hidden md:block">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      {multipleAreas && <TableHead>Rubro</TableHead>}
                      <TableHead>Productos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => isEditing(row) ? (
                      <TableRow key={`${row.area}.${row.key}`}>
                        <TableCell colSpan={multipleAreas ? 5 : 4}><RenameForm row={row} cancelHref={pageHref(filters, filters.page)} /></TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={`${row.area}.${row.key}`}>
                        <TableCell className="font-semibold">{row.label}</TableCell>
                        {multipleAreas && <TableCell>{row.areaName}</TableCell>}
                        <TableCell><ProductCount row={row} multipleAreas={multipleAreas} /></TableCell>
                        <TableCell><ProductStatusBadge active={row.active} /></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><RowActions row={row} editHref={pageHref(filters, filters.page, { editar: `${row.area}.${row.key}` })} /></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={pageRows.length} total={rows.length} noun="tipos" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
            </>
          )}
      </Card>
    </>
  )
}

// Cantidad de productos con enlace al listado de productos filtrado por el tipo.
function ProductCount({ row, multipleAreas }: { row: TypeRow; multipleAreas: boolean }) {
  const text = `${row.productCount} ${row.productCount === 1 ? 'producto' : 'productos'}`
  if (row.productCount === 0) return <span className="text-foreground-secondary">{text}</span>
  return <Link href={listHref('/catalogos', { rubro: multipleAreas ? row.area : undefined, tipo: row.key })} className="text-primary-600 hover:text-primary-700 hover:underline">{text}</Link>
}

function RowActions({ row, editHref }: { row: TypeRow; editHref: string }) {
  const usage = row.productCount === 0 ? 'Ningún producto lo usa.' : `${row.productCount} ${row.productCount === 1 ? 'producto lo usa y lo conserva' : 'productos lo usan y lo conservan'}.`
  return (
    <>
      <Link href={editHref} scroll={false} aria-label={`Renombrar ${row.label}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><Pencil />Editar</Link>
      <form action={toggleProductType}>
        <input type="hidden" name="area" value={row.area} />
        <input type="hidden" name="key" value={row.key} />
        <input type="hidden" name="active" value={String(row.active)} />
        <ConfirmSubmit
          size="sm"
          tone={row.active ? 'destructive' : 'default'}
          title={row.active ? `Desactivar el tipo ${row.label}` : `Reactivar el tipo ${row.label}`}
          description={row.active ? `Deja de ofrecerse para productos nuevos. ${usage}` : 'Vuelve a ofrecerse para productos nuevos.'}
        >
          {row.active ? 'Desactivar' : 'Reactivar'}
        </ConfirmSubmit>
      </form>
    </>
  )
}

function RenameForm({ row, cancelHref }: { row: TypeRow; cancelHref: string }) {
  return (
    <form action={updateProductType} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="area" value={row.area} />
      <input type="hidden" name="key" value={row.key} />
      <Input name="label" aria-label={`Nuevo nombre del tipo ${row.label}`} defaultValue={row.label} required maxLength={60} autoFocus className="min-w-0 flex-1 sm:max-w-xs" />
      <Button type="submit" size="sm">Guardar</Button>
      <Link href={cancelHref} scroll={false} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Cancelar</Link>
    </form>
  )
}
