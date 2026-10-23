import Link from 'next/link'
import { PackageCheck } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { CenterBadge } from '@/components/center-badge'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { EditRequestForm, type EditFormItem } from '@/components/requests/edit-request-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { centerTone, getCenters } from '@/lib/centers'
import { applySearch, searchParamSchema, searchTerms } from '@/lib/filters'
import { formatRequestNumber, relationOne } from '@/lib/requests'
import { requireRole } from '@/lib/session'

type ProductRelation = { id: string; name: string; presentation: string } | { id: string; name: string; presentation: string }[] | null
type ItemRow = { id: string; requested_quantity: number; delivered_quantity: number; closed_quantity: number; pending_quantity: number; product: ProductRelation }

// Productos para agregar que se muestran por búsqueda (el resto se encuentra buscando).
const PRODUCT_RESULTS = 8

// Corrección de la solicitud por el admin (supabase/migrations/202610230001_request_edits.sql):
// mientras tenga pendiente, cambia cantidades y agrega productos del rubro.
export default async function EditRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ buscar?: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const buscar = searchParamSchema.parse((await searchParams).buscar)
  if (!id.success) return <><BackButton fallback="/solicitudes" /><Card><ErrorState title="No encontramos la solicitud" /></Card></>
  const detailHref = `/solicitudes/${id.data}`

  const [{ data: request, error }, centers] = await Promise.all([
    supabase.from('requests').select('id, area, request_number, health_center_id, request_items(id, requested_quantity, delivered_quantity, closed_quantity, pending_quantity, product:products(id, name, presentation))').eq('id', id.data).maybeSingle(),
    getCenters(),
  ])
  if (error || !request) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>

  const rows = (request.request_items ?? []) as ItemRow[]
  const items: EditFormItem[] = rows
    .map((item) => {
      const product = relationOne(item.product)
      return { id: item.id, name: product?.name ?? 'Producto no disponible', presentation: product?.presentation ?? '—', requested: item.requested_quantity, delivered: item.delivered_quantity, closed: item.closed_quantity, minimum: item.delivered_quantity + item.closed_quantity }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const hasPending = rows.some((item) => item.pending_quantity > 0)

  // Productos activos del rubro que todavía no están en la solicitud.
  const inRequest = rows.map((item) => relationOne(item.product)?.id).filter((productId): productId is string => Boolean(productId))
  let productQuery = supabase.from('products').select('id, name, presentation').eq('active', true).eq('area', request.area as string)
  if (inRequest.length > 0) productQuery = productQuery.not('id', 'in', `(${inRequest.join(',')})`)
  productQuery = applySearch(productQuery, 'product_search_text', await searchTerms(supabase, 'productos', buscar ?? ''))
  const { data: productRows, error: productsError } = await productQuery.order('name').limit(PRODUCT_RESULTS)
  if (productsError) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar los productos" /></Card></>
  const products = (productRows ?? []).map((product) => ({ id: product.id as string, name: product.name as string, presentation: product.presentation as string }))

  const centerId = request.health_center_id as string
  const center = (centers ?? []).find((option) => option.id === centerId)

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Corregir solicitud{center && <CenterBadge name={center.name} tone={centerTone(centers ?? [], centerId)} className="text-sm" />}</span>}
        description={<>Solicitud <Link href={detailHref} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(request.request_number as number)}</Link>. El cambio queda en el historial y en la auditoría con el motivo.</>}
      />
      <Card>
        {hasPending
          ? <CardContent className="pt-5"><EditRequestForm requestId={id.data} items={items} products={products} buscar={buscar} cancelHref={detailHref} /></CardContent>
          : <EmptyState icon={PackageCheck} title="La solicitud ya no tiene pendiente" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>Solo se corrigen solicitudes con algo pendiente de entregar.</EmptyState>}
      </Card>
    </>
  )
}
