import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Package, SearchX } from 'lucide-react'
import { z } from 'zod'
import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PAGE_SIZE, ilikeAny, listHref, pageParamSchema, searchParamSchema } from '@/lib/filters'
import { productTypeLabels, productTypeParamSchema, type ProductType } from '@/lib/product-types'
import { requireSession } from '@/lib/session'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  tipo: productTypeParamSchema,
  page: pageParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/catalogo', { buscar: filters.buscar, tipo: filters.tipo }, page)
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession()
  const filters = filtersSchema.parse(await searchParams)

  return (
    <>
      <PageHeader title="Catálogo" description="Consultá los productos disponibles para solicitar." />
      <CatalogFilters buscar={filters.buscar} tipo={filters.tipo} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={PAGE_SIZE} />}>
          <ProductList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

// Solo productos activos: la política RLS ya los restringe para la farmacéutica y se explicita acá.
async function ProductList({ filters }: { filters: Filters }) {
  const { supabase } = await requireSession()
  const from = (filters.page - 1) * PAGE_SIZE
  let query = supabase.from('products').select('id, name, presentation, product_type', { count: 'exact' }).eq('active', true)
  if (filters.tipo) query = query.eq('product_type', filters.tipo)
  if (filters.buscar) query = query.or(ilikeAny(['name', 'presentation'], filters.buscar))
  const { data, count, error } = await query.order('name').range(from, from + PAGE_SIZE - 1)

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar el catálogo" />

  const products = (data ?? []) as { id: string; name: string; presentation: string; product_type: ProductType }[]
  const total = count ?? 0
  if (products.length === 0) {
    return filters.buscar || filters.tipo || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos productos">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={Package} title="Todavía no hay productos disponibles">Cuando se carguen productos aparecerán en este catálogo.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Presentación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-semibold">{product.name}</TableCell>
                <TableCell>{productTypeLabels[product.product_type]}</TableCell>
                <TableCell className="text-foreground-secondary">{product.presentation}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/catalogo/${product.id}`} aria-label={`Ver ${product.name}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <ListFooter page={filters.page} pageSize={PAGE_SIZE} shown={products.length} total={total} noun="productos" hrefFor={(page) => pageHref(filters, page)} />
    </>
  )
}
