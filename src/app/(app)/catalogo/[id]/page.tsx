import { Suspense } from 'react'
import Link from 'next/link'
import { PackageSearch } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ProductDetailSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { areaName, getAreas } from '@/lib/areas'
import { productTypeLabel, type ProductTypeRelation } from '@/lib/product-types'
import { requireSession } from '@/lib/session'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const id = z.string().uuid().safeParse((await params).id)

  return (
    <>
      <BackButton fallback="/catalogo" />
      {id.success
        ? <Suspense fallback={<ProductDetailSkeleton />}><ProductDetail id={id.data} /></Suspense>
        : <NotFound />}
    </>
  )
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon={PackageSearch} title="No encontramos el producto" action={<Link href="/catalogo" className={buttonVariants({ variant: 'secondary' })}>Volver al catálogo</Link>}>
        Puede que no exista o que ya no esté disponible.
      </EmptyState>
    </Card>
  )
}

async function ProductDetail({ id }: { id: string }) {
  const { supabase } = await requireSession()
  const areas = await getAreas() ?? []
  const { data, error } = await supabase.from('products').select('id, area, name, presentation, type:product_types(label)').eq('id', id).eq('active', true).maybeSingle()
  if (error) return <Card><ErrorState title="No pudimos cargar el producto" /></Card>
  if (!data) return <NotFound />

  // El rubro solo se muestra cuando el usuario ve más de uno.
  const product = { area: areas.length > 1 ? areaName(areas, data.area as string) : null, name: data.name as string, presentation: data.presentation as string, typeLabel: productTypeLabel(data.type as ProductTypeRelation) }
  return (
    <>
      <PageHeader title={product.name} description={product.typeLabel} />
      <Card>
        <CardHeader><CardTitle>Datos del producto</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {product.area && <div><dt className="text-xs leading-4 font-semibold text-foreground-secondary">Rubro</dt><dd className="mt-1 text-sm leading-5 text-foreground">{product.area}</dd></div>}
            <div><dt className="text-xs leading-4 font-semibold text-foreground-secondary">Nombre</dt><dd className="mt-1 text-sm leading-5 text-foreground">{product.name}</dd></div>
            <div><dt className="text-xs leading-4 font-semibold text-foreground-secondary">Tipo</dt><dd className="mt-1 text-sm leading-5 text-foreground">{product.typeLabel}</dd></div>
            <div><dt className="text-xs leading-4 font-semibold text-foreground-secondary">Presentación</dt><dd className="mt-1 text-sm leading-5 text-foreground">{product.presentation}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </>
  )
}
