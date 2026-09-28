import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Clock, FileText, Inbox, Package, PackageCheck, Plus, TriangleAlert, Truck } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { ErrorState } from '@/components/error-state'
import { DashboardSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { RequestsTable } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { areaName, getAreas } from '@/lib/areas'
import { listHref } from '@/lib/filters'
import { INBOX_FILTER, openStatuses, type RequestStatus } from '@/lib/request-status'
import { argentinaDate, formatDate, formatRequestNumber, relationOne, shiftDate, WAIT_WARNING_DAYS } from '@/lib/requests'
import { greeting } from '@/lib/greeting'
import { requireSession } from '@/lib/session'

const RECENT_LIMIT = 5
const PENDING_LIMIT = 5

export default async function Home() {
  const session = await requireSession()
  if (session.role === 'admin') return <AdminPanel />

  const newRequest = <Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>
  return (
    <>
      <PageHeader
        title={<><span className="font-semibold">{greeting()},</span> <span className="text-primary-600">{session.fullName}</span></>}
        description={session.centerName && (
          <span className="flex items-center gap-2 font-medium">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-600"><Building2 className="size-4" aria-hidden /></span>
            {session.centerName}
          </span>
        )}
        actions={newRequest}
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  )
}

async function DashboardContent() {
  const { supabase } = await requireSession()
  const areas = await getAreas() ?? []
  // Filtrado, orden y límite se resuelven en la base.
  const countByStatus = (status: RequestStatus) => supabase.from('requests').select('id', { count: 'exact', head: true }).eq('request_status', status)
  const [recentResult, pendingResult, pendingCount, partialCount, unconfirmedCount] = await Promise.all([
    supabase.from('requests').select('id, area, request_number, created_at, request_status, receipt_unconfirmed_count, receipt_discrepancy_count, request_items(count)').order('created_at', { ascending: false }).limit(RECENT_LIMIT),
    supabase.from('request_items').select('id, pending_quantity, product:products(name), request:requests(id, request_number, created_at)').gt('pending_quantity', 0).order('request(created_at)', { ascending: false }).limit(PENDING_LIMIT),
    countByStatus('pending'),
    countByStatus('partial'),
    // Solicitudes con entregas que el centro todavía no confirmó.
    supabase.from('requests').select('id', { count: 'exact', head: true }).gt('receipt_unconfirmed_count', 0),
  ])
  if ([recentResult, pendingResult, pendingCount, partialCount, unconfirmedCount].some((result) => result.error)) return <Card><ErrorState /></Card>

  const content = {
    recent: (recentResult.data ?? []).map((request) => ({ id: request.id as string, number: request.request_number as number, createdAt: request.created_at as string, productCount: (request.request_items as { count: number }[] | null)?.[0]?.count ?? 0, status: request.request_status as RequestStatus, area: areas.length > 1 ? areaName(areas, request.area as string) : undefined, unconfirmed: (request.receipt_unconfirmed_count as number) > 0, discrepancy: (request.receipt_discrepancy_count as number) > 0 })),
    pending: (pendingResult.data ?? []).flatMap((item) => {
      const request = relationOne(item.request as { id: string; request_number: number; created_at: string } | { id: string; request_number: number; created_at: string }[] | null)
      const product = relationOne(item.product as { name: string } | { name: string }[] | null)
      return request ? [{ id: item.id as string, request, product, pending: item.pending_quantity as number }] : []
    }),
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="grid gap-4 md:grid-cols-3 xl:col-span-3">
        <MetricCard icon={Clock} value={pendingCount.count ?? 0} label="Pendientes" tone="warning" href="/solicitudes?estado=pending" />
        <MetricCard icon={Truck} value={partialCount.count ?? 0} label="Entregas parciales" tone="info" href="/solicitudes?estado=partial" />
        <MetricCard icon={PackageCheck} value={unconfirmedCount.count ?? 0} label="Por confirmar recepción" tone="success" href="/solicitudes?estado=por_confirmar" />
      </div>
      <Card className="xl:col-span-2">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Últimas solicitudes</CardTitle>
          {content.recent.length > 0 && <Link href="/solicitudes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver todas<ArrowRight /></Link>}
        </CardHeader>
        <CardContent>
          {content.recent.length > 0
            ? <RequestsTable rows={content.recent} />
            : <EmptyState icon={FileText} title="Todavía no hay solicitudes" action={<Link href="/solicitudes/nueva" className={buttonVariants()}><Plus />Nueva solicitud</Link>}>Cuando realices una solicitud aparecerá en este listado.</EmptyState>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos pendientes de recibir</CardTitle>
          <CardDescription>Productos con cantidades todavía pendientes.</CardDescription>
        </CardHeader>
        <CardContent>
          {content.pending.length > 0 ? (
            <ul className="divide-y divide-border">
              {content.pending.map(({ id, request, product, pending }) => (
                <li key={id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-600"><Package className="size-5" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-5 font-semibold text-foreground">{product?.name ?? 'Producto no disponible'}</p>
                    <Link href={`/solicitudes/${request.id}`} className="text-xs leading-4 text-foreground-secondary hover:text-primary-600 hover:underline">{formatRequestNumber(request.request_number)} · {formatDate(request.created_at)}</Link>
                  </div>
                  <p className="shrink-0 text-right text-warning">
                    <span className="block text-lg leading-6 font-bold tabular-nums">{pending}</span>
                    <span className="text-xs leading-4">pendientes</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={PackageCheck} title="No hay productos pendientes">Los productos con cantidades por recibir aparecerán aquí.</EmptyState>}
        </CardContent>
      </Card>
    </div>
  )
}

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'

// Indicadores de trabajo del admin; cada uno lleva al listado con el filtro equivalente.
async function AdminPanel() {
  const { supabase, fullName } = await requireSession()
  const today = argentinaDate(Date.now())
  // "Esperando": abiertas creadas hasta ese día inclusive (WAIT_WARNING_DAYS días calendario o más).
  const lateUntil = shiftDate(today, -WAIT_WARNING_DAYS)
  const requestCount = () => supabase.from('requests').select('id', { count: 'exact', head: true })
  const [{ count: openCount }, { count: lateCount }, { count: deliveriesToday }, { count: discrepancyCount }] = await Promise.all([
    // Misma vista que la bandeja: con pendiente o con diferencia de recepción sin resolver.
    requestCount().or(INBOX_FILTER),
    requestCount().in('request_status', openStatuses).lt('created_at', `${shiftDate(lateUntil, 1)}T00:00:00${DAY_OFFSET}`),
    supabase.from('deliveries').select('id', { count: 'exact', head: true }).is('voided_at', null).gte('created_at', `${today}T00:00:00${DAY_OFFSET}`),
    requestCount().gt('receipt_discrepancy_count', 0),
  ])

  return (
    <>
      <PageHeader title="Panel de trabajo" description={`Hola, ${fullName}.`} />
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard icon={Inbox} value={openCount ?? 0} label="Solicitudes por atender" tone="warning" href="/solicitudes" />
        <MetricCard icon={Clock} value={lateCount ?? 0} label={`Esperando ${WAIT_WARNING_DAYS} días o más`} tone="warning" href={listHref('/solicitudes', { hasta: lateUntil })} />
        <MetricCard icon={Truck} value={deliveriesToday ?? 0} label="Entregas de hoy" tone="success" href={listHref('/entregas', { desde: today, estado: 'activa' })} />
        <MetricCard icon={TriangleAlert} value={discrepancyCount ?? 0} label="Diferencias de recepción por resolver" tone="warning" href={listHref('/solicitudes', { estado: 'con_diferencia' })} />
      </section>
    </>
  )
}
