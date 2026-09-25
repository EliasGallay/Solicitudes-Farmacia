import { Fragment } from 'react'
import { PageSizeSelect } from '@/components/page-size-select'
import { cn } from '@/lib/utils'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'

function visiblePages(current: number, total: number) {
  return [...new Set([1, current - 1, current, current + 1, total])].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

// Paginación estándar de listados: resumen, filas por página y navegación entre páginas.
// Va pegada al listado que controla; no impone contenedor (en una card: <CardFooter divided>).
// Sin dependencias de servidor: se puede usar desde páginas y desde componentes cliente.
// Debajo de sm: resumen arriba y controles abajo; la paginación muestra solo "actual / total".
export function ListFooter({ page, pageSize, shown, total, noun, hrefFor, className }: { page: number; pageSize: number; shown: number; total: number; noun: string; hrefFor: (page: number) => string; className?: string }) {
  const from = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className={cn('flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2', className)}>
      <p className="text-xs leading-4 text-foreground-muted" aria-live="polite">Mostrando {shown > 0 ? from + 1 : 0} a {from + shown} de {total} {noun}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
        <PageSizeSelect value={pageSize} />
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href={hrefFor(page - 1)} disabled={page <= 1} /></PaginationItem>
              <PaginationItem className="px-2 text-sm font-medium whitespace-nowrap text-foreground-secondary tabular-nums sm:hidden">{page} / {totalPages}</PaginationItem>
              {visiblePages(page, totalPages).map((value, index, pages) => (
                <Fragment key={value}>
                  {index > 0 && value - pages[index - 1] > 1 && <PaginationItem className="max-sm:hidden"><PaginationEllipsis /></PaginationItem>}
                  <PaginationItem className="max-sm:hidden"><PaginationLink href={hrefFor(value)} isActive={value === page}>{value}</PaginationLink></PaginationItem>
                </Fragment>
              ))}
              <PaginationItem><PaginationNext href={hrefFor(page + 1)} disabled={page >= totalPages} /></PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  )
}
