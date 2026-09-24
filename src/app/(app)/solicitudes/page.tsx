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
import { Card, CardContent } from '@/components/ui/card'
import { statusParamSchema, type RequestStatus } from '@/lib/request-status'
import { PAGE_SIZE, listHref, pageParamSchema, searchParamSchema } from '@/lib/filters'
import { parseRequestNumber } from '@/lib/requests'
import { requireSession } from '@/lib/session'

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'

const filtersSchema = z.object({
  numero: searchParamSchema,
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  estado: statusParamSchema,
  page: pageParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function pageHref(filters: Filters, page: number) {
  return listHref('/solicitudes', { numero: filters.numero, desde: filters.desde, hasta: filters.hasta, estado: filters.estado }, page)
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
      <RequestFilters numero={filters.numero} desde={filters.desde} hasta={filters.hasta} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={PAGE_SIZE} />}>
          <RequestsList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

async function RequestsList({ filters }: { filters: Filters }) {
  const { supabase } = await requireSession()
  const from = (filters.page - 1) * PAGE_SIZE
  const number = filters.numero ? parseRequestNumber(filters.numero) : undefined
  if (number === null) return <EmptyState icon={SearchX} title="No encontramos solicitudes">Ingresá un número de solicitud válido, por ejemplo SOL-1024.</EmptyState>

  let query = supabase.from('requests').select('id, request_number, created_at, request_status, request_items(count)', { count: 'exact' }).order('created_at', { ascending: false })
  if (number !== undefined) query = query.eq('request_number', number)
  if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00${DAY_OFFSET}`)
  if (filters.estado) query = query.eq('request_status', filters.estado)
  if (filters.hasta) query = query.lt('created_at', `${nextDay(filters.hasta)}T00:00:00${DAY_OFFSET}`)
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las solicitudes" />

  const rows = (data ?? []).map((request) => ({ id: request.id as string, number: request.request_number as number, createdAt: request.created_at as string, productCount: (request.request_items as { count: number }[] | null)?.[0]?.count ?? 0, status: request.request_status as RequestStatus }))
  const total = count ?? 0
  const hasFilters = Boolean(filters.numero || filters.desde || filters.hasta || filters.estado)

  if (rows.length === 0) {
    return hasFilters || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos solicitudes">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={FileText} title="Todavía no hay solicitudes" action={<Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}>Cuando realices una solicitud aparecerá en este listado.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5"><RequestsTable rows={rows} /></CardContent>
      <ListFooter page={filters.page} pageSize={PAGE_SIZE} shown={rows.length} total={total} noun="solicitudes" hrefFor={(page) => pageHref(filters, page)} />
    </>
  )
}
