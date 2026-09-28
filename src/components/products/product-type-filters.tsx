'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import type { Area } from '@/lib/areas'

const ALL = 'todos'

// Filtros de tipos de producto (admin). `areas`: solo con más de un rubro.
export function ProductTypeFilters({ areas, buscar, rubro, estado }: { areas?: Area[]; buscar?: string; rubro?: string; estado?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="tipos-buscar" label="Tipo" wide>
        <FilterSearch id="tipos-buscar" placeholder="Buscar por nombre..." value={search.value} onChange={search.setValue} />
      </FilterField>
      {areas && (
        <FilterField id="tipos-rubro" label="Rubro">
          <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value })}>
            <SelectTrigger id="tipos-rubro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los rubros</SelectItem>
              {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}{!area.active && ' (inactivo)'}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      )}
      <FilterField id="tipos-estado" label="Estado">
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="tipos-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !rubro && !estado} onClick={clear} />
    </FilterBar>
  )
}
