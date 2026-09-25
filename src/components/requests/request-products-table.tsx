import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '@/components/status-badge'
import { MobileList, MobileListFields, MobileListHeader, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { productTypeLabels, type ProductType } from '@/lib/product-types'
import type { RequestStatus } from '@/lib/request-status'
import { cn } from '@/lib/utils'

export type RequestProductRow = { id: string; name: string; type: ProductType | null; presentation: string; requested: number; delivered: number; pending: number; status: RequestStatus }

function productSubtitle(item: RequestProductRow) {
  return [item.type ? productTypeLabels[item.type] : null, item.presentation].filter(Boolean).join(' · ')
}

export function RequestProductsTable({ items }: { items: RequestProductRow[] }) {
  if (items.length === 0) return <EmptyState icon={SearchX} title="No encontramos productos">Probá modificando los filtros aplicados.</EmptyState>

  return (
    <>
      <MobileList>
        {items.map((item) => (
          <MobileListItem key={item.id}>
            <MobileListHeader title={item.name} subtitle={productSubtitle(item)} aside={<StatusBadge status={item.status} />} />
            <MobileListFields fields={[
              { label: 'Solicitado', value: item.requested },
              { label: 'Entregado', value: item.delivered },
              { label: 'Pendiente', value: item.pending, className: cn(item.pending > 0 && 'text-warning') },
            ]} />
          </MobileListItem>
        ))}
      </MobileList>
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="hidden xl:table-cell">Tipo</TableHead>
            <TableHead className="hidden xl:table-cell">Presentación</TableHead>
            <TableHead className="text-right">Solicitado</TableHead>
            <TableHead className="text-right">Entregado</TableHead>
            <TableHead className="text-right">Pendiente</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="font-semibold">{item.name}</span>
                {/* Entre md y xl, tipo y presentación van bajo el nombre para que entren las 7 columnas. */}
                <span className="block text-xs leading-4 text-foreground-secondary xl:hidden">{productSubtitle(item)}</span>
              </TableCell>
              <TableCell className="hidden xl:table-cell">{item.type ? productTypeLabels[item.type] : '—'}</TableCell>
              <TableCell className="hidden text-foreground-secondary xl:table-cell">{item.presentation}</TableCell>
              <TableCell className="text-right tabular-nums">{item.requested}</TableCell>
              <TableCell className="text-right tabular-nums">{item.delivered}</TableCell>
              <TableCell className={cn('text-right tabular-nums', item.pending > 0 && 'font-semibold text-warning')}>{item.pending}</TableCell>
              <TableCell><StatusBadge status={item.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
