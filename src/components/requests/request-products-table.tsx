import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '@/components/status-badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productTypeLabels, type ProductType } from '@/lib/product-types'
import type { RequestStatus } from '@/lib/request-status'
import { cn } from '@/lib/utils'

export type RequestProductRow = { id: string; name: string; type: ProductType | null; presentation: string; requested: number; delivered: number; pending: number; status: RequestStatus }

export function RequestProductsTable({ items }: { items: RequestProductRow[] }) {
  if (items.length === 0) return <EmptyState icon={SearchX} title="No encontramos productos">Probá modificando los filtros aplicados.</EmptyState>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Presentación</TableHead>
          <TableHead className="text-right">Solicitado</TableHead>
          <TableHead className="text-right">Entregado</TableHead>
          <TableHead className="text-right">Pendiente</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-semibold">{item.name}</TableCell>
            <TableCell>{item.type ? productTypeLabels[item.type] : '—'}</TableCell>
            <TableCell className="text-foreground-secondary">{item.presentation}</TableCell>
            <TableCell className="text-right tabular-nums">{item.requested}</TableCell>
            <TableCell className="text-right tabular-nums">{item.delivered}</TableCell>
            <TableCell className={cn('text-right tabular-nums', item.pending > 0 && 'font-semibold text-warning')}>{item.pending}</TableCell>
            <TableCell><StatusBadge status={item.status} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
