import { Fragment } from 'react'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'

function visiblePages(current: number, total: number) {
  return [...new Set([1, current - 1, current, current + 1, total])].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
}

// Pie de listados paginados: resumen "Mostrando X a Y de Z" y paginación.
export function ListFooter({ page, pageSize, shown, total, noun, hrefFor }: { page: number; pageSize: number; shown: number; total: number; noun: string; hrefFor: (page: number) => string }) {
  const from = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
      <p className="text-sm text-foreground-secondary">Mostrando {from + 1} a {from + shown} de {total} {noun}</p>
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
  )
}
