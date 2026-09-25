import * as React from 'react'
import { cn } from '@/lib/utils'

// `containerClassName`: p. ej. `hidden md:block` cuando debajo de md se muestra una MobileList.
export function Table({ className, containerClassName, ...props }: React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return <div className={cn('relative w-full overflow-x-auto', containerClassName)}><table className={cn('w-full caption-bottom text-sm', className)} {...props} /></div>
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted', className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border transition-colors', className)} {...props} />
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-10 px-3 text-left align-middle text-xs font-semibold text-foreground-secondary first:rounded-l-md last:rounded-r-md', className)} {...props} />
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-12 bg-surface px-3 py-2 align-middle text-sm text-foreground', className)} {...props} />
}
