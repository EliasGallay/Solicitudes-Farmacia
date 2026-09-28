import Link from 'next/link'
import { PackageX } from 'lucide-react'
import { z } from 'zod'
import { toggleProduct, updateProduct } from '@/app/product-actions'
import { BackButton } from '@/components/back-button'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { ProductForm } from '@/components/products/product-form'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAreas, getProductTypes } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { requireRole } from '@/lib/session'

export default async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const feedback = await searchParams
  if (!id.success) return <><BackButton fallback="/catalogos" /><NotFound /></>

  const [{ data: product, error }, areas, types] = await Promise.all([
    supabase.from('products').select('id, area, name, presentation, product_type, active').eq('id', id.data).maybeSingle(),
    getAreas(true),
    getProductTypes(),
  ])
  if (error) return <><BackButton fallback="/catalogos" /><Card><ErrorState title="No pudimos cargar el producto" /></Card></>
  if (!product) return <><BackButton fallback="/catalogos" /><NotFound /></>

  const active = product.active as boolean
  // Un producto existente puede seguir en un rubro inactivo; los demás rubros inactivos no se ofrecen.
  const areaOptions = (areas ?? []).filter((area) => area.active || area.key === product.area)

  return (
    <>
      <BackButton fallback="/catalogos" />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{product.name as string}<ProductStatusBadge active={active} /></span>}
        description={product.presentation as string}
      />
      {feedbackMessage(feedback.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedback.error)}</FormError></div>}

      <Card>
        <CardHeader><CardTitle>Datos del producto</CardTitle></CardHeader>
        <CardContent>
          <ProductForm
            action={updateProduct}
            areas={areaOptions}
            types={types ?? []}
            productId={product.id as string}
            defaultValues={{ area: product.area as string, name: product.name as string, presentation: product.presentation as string, product_type: product.product_type as string }}
            submitLabel="Guardar"
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{active ? 'Desactivar producto' : 'Reactivar producto'}</CardTitle>
          <CardDescription>{active ? 'El producto deja de ofrecerse en nuevas solicitudes. Las solicitudes existentes lo conservan.' : 'El producto vuelve a ofrecerse en nuevas solicitudes.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={toggleProduct}>
            <input type="hidden" name="id" value={product.id as string} />
            <input type="hidden" name="active" value={String(active)} />
            <ConfirmSubmit
              variant={active ? 'destructive' : 'secondary'}
              title={active ? `Desactivar ${product.name}` : `Reactivar ${product.name}`}
              description={active ? 'Deja de ofrecerse en nuevas solicitudes. Las solicitudes existentes lo conservan.' : 'Vuelve a ofrecerse en nuevas solicitudes.'}
            >
              {active ? 'Desactivar' : 'Reactivar'}
            </ConfirmSubmit>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon={PackageX} title="No encontramos el producto" action={<Link href="/catalogos" className={buttonVariants({ variant: 'secondary' })}>Volver a catálogos</Link>}>
        Puede que el enlace sea incorrecto.
      </EmptyState>
    </Card>
  )
}
