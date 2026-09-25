import { Suspense } from 'react'
import Link from 'next/link'
import { CircleCheck, FileQuestion, Plus } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ProductSelectionSkeleton, RequestSentSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { NewRequestWizard } from '@/components/requests/new-request-wizard'
import { RequestStepper } from '@/components/requests/request-stepper'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { likeContains, pageParamSchema, pageRange, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { productTypeParamSchema, type ProductType } from '@/lib/product-types'
import { formatDateTime, formatRequestNumber } from '@/lib/requests'
import { requireSession } from '@/lib/session'

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ enviada?: string; buscar?: string; tipo?: string; page?: string; por_pagina?: string }> }) {
  const session = await requireSession()
  const params = await searchParams
  const sentId = z.string().uuid().safeParse(params.enviada)
  const buscar = searchParamSchema.parse(params.buscar)
  const tipo = productTypeParamSchema.parse(params.tipo)
  const page = pageParamSchema.parse(params.page)
  const pageSize = pageSizeParamSchema.parse(params.por_pagina)

  return (
    <>
      <PageHeader title="Nueva solicitud" description="Seleccioná los productos y las cantidades que necesitás." />
      {sentId.success ? (
        <>
          <RequestStepper current={3} />
          <Suspense fallback={<RequestSentSkeleton />}>
            <RequestSent id={sentId.data} />
          </Suspense>
        </>
      ) : (
        <Suspense fallback={<ProductSelectionSkeleton />}>
          <ProductSelection buscar={buscar} tipo={tipo} page={page} pageSize={pageSize} isAdmin={session.role === 'admin'} />
        </Suspense>
      )}
    </>
  )
}

// Búsqueda y paginación se resuelven en la base; el total general permite distinguir
// "sin resultados" de "sin productos".
async function ProductSelection({ buscar, tipo, page, pageSize, isAdmin }: { buscar?: string; tipo?: ProductType; page: number; pageSize: number; isAdmin: boolean }) {
  const { supabase } = await requireSession()
  let query = supabase.from('products').select('id, name, presentation, product_type', { count: 'exact' }).eq('active', true)
  if (tipo) query = query.eq('product_type', tipo)
  for (const token of searchTokens(buscar ?? '')) query = query.ilike('product_search_text', likeContains(token))
  const [productsResult, totalResult, centersResult] = await Promise.all([
    query.order('name').range(...pageRange(page, pageSize)),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
    // Solo el admin elige centro; la farmacéutica usa siempre el de su perfil.
    isAdmin ? supabase.from('health_centers').select('id, name').eq('active', true).order('name') : Promise.resolve({ data: null, error: null }),
  ])
  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  const loadError = (productsResult.error?.code !== 'PGRST103' && productsResult.error) || totalResult.error || centersResult.error
  if (loadError) {
    console.error('Error al cargar productos para nueva solicitud', loadError)
    return <Card><ErrorState title="No pudimos cargar los productos" /></Card>
  }
  return <NewRequestWizard products={(productsResult.data ?? []) as { id: string; name: string; presentation: string; product_type: ProductType }[]} total={totalResult.count ?? 0} matching={productsResult.count ?? 0} page={page} pageSize={pageSize} buscar={buscar} tipo={tipo} centers={isAdmin ? (centersResult.data ?? []) as { id: string; name: string }[] : undefined} />
}

async function RequestSent({ id }: { id: string }) {
  const { supabase } = await requireSession()
  const { data, error } = await supabase.from('requests').select('id, request_number, created_at, request_items(count)').eq('id', id).maybeSingle()
  if (error) return <Card><ErrorState /></Card>
  if (!data) return <Card><EmptyState icon={FileQuestion} title="No encontramos la solicitud" action={<Link href="/solicitudes" className={buttonVariants({ variant: 'secondary' })}>Ir a solicitudes</Link>} /></Card>

  const productCount = (data.request_items as { count: number }[] | null)?.[0]?.count ?? 0
  return (
    <Card role="status" className="mx-auto flex max-w-xl motion-safe:animate-enter-from-below flex-col items-center gap-2 px-4 py-8 text-center sm:px-6 sm:py-10">
      <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-success-muted text-success"><CircleCheck className="size-8" aria-hidden /></div>
      <h2 className="text-xl leading-7 font-bold text-foreground">Solicitud enviada correctamente</h2>
      <p className="text-sm leading-5 text-foreground-secondary">Tu solicitud quedó registrada con el número:</p>
      <p className="my-2 rounded-md bg-primary-50 px-4 py-2 text-2xl leading-8 font-bold text-primary-700">{formatRequestNumber(data.request_number as number)}</p>
      <p className="text-sm leading-5 text-foreground-secondary">Fecha: {formatDateTime(data.created_at as string)}</p>
      <p className="text-sm leading-5 text-foreground-secondary">{productCount} {productCount === 1 ? 'producto solicitado' : 'productos solicitados'}</p>
      <div className="mt-4 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
        <Link href={`/solicitudes/${data.id}`} className={buttonVariants()}>Ver solicitud</Link>
        <Link href="/solicitudes/nueva" className={buttonVariants({ variant: 'secondary' })}><Plus />Nueva solicitud</Link>
      </div>
    </Card>
  )
}
