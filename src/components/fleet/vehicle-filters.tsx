'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'

// Por defecto se listan los activos (sin ?estado=).
const ACTIVE = 'activos'

export function VehicleFilters({ buscar, estado }: { buscar?: string; estado?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="vehiculos-buscar" label="Vehículo" wide>
        <FilterSearch id="vehiculos-buscar" placeholder="Buscar por identificador, nombre, marca o dominio..." value={search.value} onChange={search.setValue} />
      </FilterField>
      <FilterField id="vehiculos-estado" label="Estado">
        <Select value={estado ?? ACTIVE} onValueChange={(value) => setFilters({ estado: value === ACTIVE ? undefined : value })}>
          <SelectTrigger id="vehiculos-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTIVE}>Activos</SelectItem>
            <SelectItem value="inactivos">Inactivos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !estado} onClick={clear} />
    </FilterBar>
  )
}
