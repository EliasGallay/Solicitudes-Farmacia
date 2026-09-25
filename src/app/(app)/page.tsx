import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, CircleCheck, Clock, FileText, Package, PackageCheck, Plus, Truck } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { MetricCard } from '@/components/metric-card'
import { ErrorState } from '@/components/error-state'
import { DashboardSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { RequestsTable } from '@/components/requests/requests-table'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RequestStatus } from '@/lib/request-status'
import { formatDate, formatRequestNumber, relationOne } from '@/lib/requests'
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
  // Filtrado, orden y límite se resuelven en la base.
  const countByStatus = (status: RequestStatus) => supabase.from('requests').select('id', { count: 'exact', head: true }).eq('request_status', status)
  const [recentResult, pendingResult, pendingCount, partialCount, completedCount] = await Promise.all([
    supabase.from('requests').select('id, request_number, created_at, request_status, request_items(count)').order('created_at', { ascending: false }).limit(RECENT_LIMIT),
    supabase.from('request_items').select('id, pending_quantity, product:products(name), request:requests(id, request_number, created_at)').gt('pending_quantity', 0).order('request(created_at)', { ascending: false }).limit(PENDING_LIMIT),
    countByStatus('pending'),
    countByStatus('partial'),
    countByStatus('completed'),
  ])
  if ([recentResult, pendingResult, pendingCount, partialCount, completedCount].some((result) => result.error)) return <Card><ErrorState /></Card>

  const content = {
    recent: (recentResult.data ?? []).map((request) => ({ id: request.id as string, number: request.request_number as number, createdAt: request.created_at as string, productCount: (request.request_items as { count: number }[] | null)?.[0]?.count ?? 0, status: request.request_status as RequestStatus })),
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
        <MetricCard icon={CircleCheck} value={completedCount.count ?? 0} label="Completadas" tone="success" href="/solicitudes?estado=completed" />
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

async function AdminPanel() {
  const { supabase, fullName } = await requireSession()
  const [{ count: requestCount }, { count: productCount }] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
  ])

  return (
    <>
      <PageHeader title="Panel de trabajo" description={`Hola, ${fullName}.`} />
      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/solicitudes" className="rounded-lg border border-border bg-surface p-6 shadow-card transition hover:border-primary-500">
          <p className="text-sm text-foreground-secondary">Solicitudes registradas</p>
          <p className="mt-2 text-3xl font-bold">{requestCount ?? 0}</p>
          <p className="mt-3 text-sm text-foreground-secondary">Consultar historial y seguimiento</p>
        </Link>
        <Link href="/catalogos" className="rounded-lg border border-border bg-surface p-6 shadow-card transition hover:border-primary-500">
          <p className="text-sm text-foreground-secondary">Productos activos</p>
          <p className="mt-2 text-3xl font-bold">{productCount ?? 0}</p>
          <p className="mt-3 text-sm text-foreground-secondary">Consultar catálogos disponibles</p>
        </Link>
      </section>
      <section className="mt-8 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-xl font-bold">Acciones rápidas</h2>
        <p className="mt-2 text-foreground-secondary">Elegí un módulo desde la navegación para continuar.</p>
        <Link href="/solicitudes/nueva" className={buttonVariants({ className: 'mt-5' })}>Crear nueva solicitud</Link>
      </section>
    </>
  )
}
