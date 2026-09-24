import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/status-badge'
import type { RequestStatus } from '@/lib/request-status'
import { formatDateTime, formatRequestNumber } from '@/lib/requests'

export type RequestRow = { id: string; number: number; createdAt: string; productCount: number; status: RequestStatus }

// Último movimiento queda fuera hasta que el backend lo provea.
export function RequestsTable({ rows }: { rows: RequestRow[] }) {
  return (
    <Table>
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
              <TableCell className="font-semibold">{number}</TableCell>
              <TableCell>{formatDateTime(row.createdAt)}</TableCell>
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
  )
}

export function RequestsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando solicitudes">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-9 w-full" />)}
    </div>
  )
}
