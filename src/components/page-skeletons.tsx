import { RequestsTableSkeleton } from '@/components/requests/requests-table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// Skeletons compartidos entre los `loading.tsx` (navegación) y los `Suspense` de cada página,
// para que la transición entre ambos no produzca saltos visuales.

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4" aria-hidden>
      <div className="flex flex-col gap-2"><Skeleton className="h-10 w-80 bg-border" /><Skeleton className="h-6 w-64 bg-border" /></div>
      {withAction && <Skeleton className="h-10 w-44 bg-border" />}
    </div>
  )
}

function MetricCardsSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <Card key={index} className="flex items-center gap-4 p-5"><Skeleton className="size-12" /><div className="flex flex-col gap-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-4 w-32" /></div></Card>
  ))
}

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-3" aria-busy="true" aria-label="Cargando inicio">
      <div className="grid gap-4 sm:grid-cols-3 xl:col-span-3"><MetricCardsSkeleton count={3} /></div>
      <Card className="xl:col-span-2"><CardHeader><Skeleton className="h-7 w-48" /></CardHeader><CardContent><RequestsTableSkeleton /></CardContent></Card>
      <Card>
        <CardHeader><Skeleton className="h-7 w-56" /><Skeleton className="h-5 w-64" /></CardHeader>
        <CardContent className="flex flex-col gap-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</CardContent>
      </Card>
    </div>
  )
}

export function RequestListSkeleton({ rows }: { rows: number }) {
  return <CardContent className="pt-5"><RequestsTableSkeleton rows={rows} /></CardContent>
}

export function RequestDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando solicitud">
      <PageHeaderSkeleton />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCardsSkeleton count={4} /></div>
      <Skeleton className="mb-6 h-2 w-full bg-border" />
      <Card><CardHeader><Skeleton className="h-7 w-32" /></CardHeader><CardContent><RequestsTableSkeleton rows={3} /></CardContent></Card>
    </div>
  )
}

export function ProductSelectionSkeleton() {
  return <Card><CardHeader><Skeleton className="h-7 w-64" /></CardHeader><CardContent><RequestsTableSkeleton rows={6} /></CardContent></Card>
}

export function RequestSentSkeleton() {
  return <Card className="mx-auto max-w-xl p-10"><Skeleton className="mx-auto h-40 w-full" /></Card>
}

export function ProductDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando producto">
      <PageHeaderSkeleton />
      <Card><CardHeader><Skeleton className="h-7 w-48" /></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</CardContent></Card>
    </div>
  )
}

// Genérico para pantallas sin un skeleton propio.
export function SectionSkeleton() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card><CardContent className="pt-5"><RequestsTableSkeleton /></CardContent></Card>
    </>
  )
}
