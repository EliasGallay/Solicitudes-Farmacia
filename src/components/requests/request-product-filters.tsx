'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'

const ALL = 'todos'
const pendingFilters = [
  { value: ALL, label: 'Todos' },
  { value: 'con', label: 'Con pendiente' },
  { value: 'sin', label: 'Sin pendiente' },
] as const

export function RequestProductFilters({ buscar, pendiente }: { buscar?: string; pendiente?: 'con' | 'sin' }) {
  const { setFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
        <Input type="search" aria-label="Buscar producto" placeholder="Buscar producto..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
      </div>
      {/* Selección única obligatoria: se ignora el intento de deseleccionar la opción activa. */}
      <ToggleGroup type="single" aria-label="Filtrar por cantidad pendiente" value={pendiente ?? ALL} className="w-full sm:w-auto" onValueChange={(value) => value && setFilters({ pendiente: value === ALL ? undefined : value })}>
        {pendingFilters.map((filter) => <ToggleGroupItem key={filter.value} value={filter.value} className="min-w-0 flex-1 px-1.5 text-xs min-[360px]:px-2 min-[360px]:text-sm sm:flex-none sm:px-3">{filter.label}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  )
}
