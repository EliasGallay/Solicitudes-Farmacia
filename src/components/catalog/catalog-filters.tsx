'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import type { Area } from '@/lib/areas'

const ALL = 'todos'

// `areas`: solo cuando el usuario ve más de un rubro. `types`: tipos activos del rubro elegido
// (vacío mientras no haya rubro: el filtro de tipo queda deshabilitado).
export function CatalogFilters({ areas, rubro, types, buscar, tipo }: { areas?: Area[]; rubro?: string; types: { key: string; label: string }[]; buscar?: string; tipo?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="catalogo-buscar" label="Producto" wide>
        <FilterSearch id="catalogo-buscar" placeholder="Buscar por nombre o presentación..." value={search.value} onChange={search.setValue} />
      </FilterField>
      {areas && (
        <FilterField id="catalogo-rubro" label="Rubro">
          {/* Cambiar de rubro limpia el tipo: los tipos dependen del rubro. */}
          <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value, tipo: undefined })}>
            <SelectTrigger id="catalogo-rubro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los rubros</SelectItem>
              {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      )}
      <FilterField id="catalogo-tipo" label="Tipo">
        <Select value={tipo ?? ALL} disabled={types.length === 0} onValueChange={(value) => setFilters({ tipo: value === ALL ? undefined : value })}>
          <SelectTrigger id="catalogo-tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{types.length === 0 && areas ? 'Elegí un rubro' : 'Todos los tipos'}</SelectItem>
            {types.map((type) => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!rubro && !buscar && !tipo} onClick={clear} />
    </FilterBar>
  )
}
