'use client'

import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { PAGE_SIZES, pageSizeParam } from '@/lib/filters'

// Cambia ?por_pagina= y vuelve a la página 1 (setFilters reinicia la paginación).
export function PageSizeSelect({ value }: { value: number }) {
  const { setFilters, pending } = useUrlFilters()
  const labelId = useId()

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-xs whitespace-nowrap text-foreground-muted">Filas por página</span>
      <Select value={String(value)} disabled={pending} onValueChange={(size) => setFilters({ por_pagina: pageSizeParam(Number(size)) })}>
        <SelectTrigger aria-labelledby={labelId} className="h-8 w-16 px-2 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
