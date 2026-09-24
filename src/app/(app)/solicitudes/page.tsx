import { Suspense } from 'react'
import Link from 'next/link'
import { FileText, Plus, SearchX } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { RequestFilters } from '@/components/requests/request-filters'
import { RequestsTable } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { statusParamSchema, type RequestStatus } from '@/lib/request-status'
import { likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { parseRequestNumber } from '@/lib/requests'
import { requireSession } from '@/lib/session'

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  estado: statusParamSchema,
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function pageHref(filters: Filters, page: number) {
  return listHref('/solicitudes', { buscar: filters.buscar, desde: filters.desde, hasta: filters.hasta, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireSession()
  const filters = filtersSchema.parse(await searchParams)

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Visualizá todas tus solicitudes de insumos de farmacia."
        actions={<Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}
      />
      <RequestFilters buscar={filters.buscar} desde={filters.desde} hasta={filters.hasta} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <RequestsList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

async function RequestsList({ filters }: { filters: Filters }) {
  const { supabase } = await requireSession()
  // Búsqueda (en la base, columnas de supabase/migrations/202609240006_search.sql):
  // - un número ("2", "#2", "SOL-2") busca por número parcial y ordena ascendente, por lo que la
  //   coincidencia exacta queda primera (todo número que contiene esos dígitos es mayor o igual);
  // - cualquier otro texto busca cada palabra en el número y los productos, sin distinguir acentos.
  const number = filters.buscar ? parseRequestNumber(filters.buscar) : null

  let query = supabase.from('requests').select('id, request_number, created_at, request_status, request_items(count)', { count: 'exact' })
  if (number !== null) query = query.ilike('request_number_text', likeContains(String(number)))
  else for (const token of searchTokens(filters.buscar ?? '')) query = query.ilike('request_search_text', likeContains(token))
  if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00${DAY_OFFSET}`)
  if (filters.estado) query = query.eq('request_status', filters.estado)
  if (filters.hasta) query = query.lt('created_at', `${nextDay(filters.hasta)}T00:00:00${DAY_OFFSET}`)
  const ordered = number !== null ? query.order('request_number', { ascending: true }) : query.order('created_at', { ascending: false })
  const { data, count, error } = await ordered.range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las solicitudes" />

  const rows = (data ?? []).map((request) => ({ id: request.id as string, number: request.request_number as number, createdAt: request.created_at as string, productCount: (request.request_items as { count: number }[] | null)?.[0]?.count ?? 0, status: request.request_status as RequestStatus }))
  const total = count ?? 0
  const hasFilters = Boolean(filters.buscar || filters.desde || filters.hasta || filters.estado)

  if (rows.length === 0) {
    return hasFilters || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos solicitudes">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={FileText} title="Todavía no hay solicitudes" action={<Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}>Cuando realices una solicitud aparecerá en este listado.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5"><RequestsTable rows={rows} /></CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun="solicitudes" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
