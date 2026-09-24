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
export function ListFooter({ page, pageSize, shown, total, noun, hrefFor, className }: { page: number; pageSize: number; shown: number; total: number; noun: string; hrefFor: (page: number) => string; className?: string }) {
  const from = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className={cn('flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}>
      <p className="text-xs leading-4 text-foreground-muted" aria-live="polite">Mostrando {shown > 0 ? from + 1 : 0} a {from + shown} de {total} {noun}</p>
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} />
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href={hrefFor(page - 1)} disabled={page <= 1} /></PaginationItem>
              {visiblePages(page, totalPages).map((value, index, pages) => (
                <Fragment key={value}>
                  {index > 0 && value - pages[index - 1] > 1 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                  <PaginationItem><PaginationLink href={hrefFor(value)} isActive={value === page}>{value}</PaginationLink></PaginationItem>
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
