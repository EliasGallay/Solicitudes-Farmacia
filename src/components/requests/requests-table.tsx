import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import type { RequestStatus } from '@/lib/request-status'
import { formatDateTime, formatRequestNumber } from '@/lib/requests'

export type RequestRow = { id: string; number: number; createdAt: string; productCount: number; status: RequestStatus }

// Último movimiento queda fuera hasta que el backend lo provea.
// Debajo de md cada solicitud es un enlace a su detalle; desde md, tabla.
export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  return (
    <>
      <MobileList>
        {rows.map((row) => {
          const number = formatRequestNumber(row.number)
          return (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/solicitudes/${row.id}`} aria-label={`Ver solicitud ${number}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold text-foreground">{number}</span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 text-xs leading-4 text-foreground-secondary">{formatDateTime(row.createdAt)} · {row.productCount} {row.productCount === 1 ? 'producto' : 'productos'}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          )
        })}
      </MobileList>
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>N° solicitud</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Productos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const number = formatRequestNumber(row.number)
            return (
              <TableRow key={row.id}>
                <TableCell className="font-semibold whitespace-nowrap">{number}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.productCount}</TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell className="text-right">
                  <Link href={`/solicitudes/${row.id}`} aria-label={`Ver solicitud ${number}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}

export function RequestsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando solicitudes">
      <Skeleton className="hidden h-10 w-full md:block" />
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-12 w-full md:h-9" />)}
    </div>
  )
}
