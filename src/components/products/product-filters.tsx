'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import type { Area } from '@/lib/areas'

const ALL = 'todos'

// Filtros de la gestión de productos (admin). `areas`: solo con más de un rubro. `types`: tipos del
// rubro elegido, incluidos los inactivos (vacío mientras no haya rubro: el filtro queda deshabilitado).
export function ProductFilters({ areas, rubro, types, buscar, tipo, estado }: { areas?: Area[]; rubro?: string; types: { key: string; label: string; active: boolean }[]; buscar?: string; tipo?: string; estado?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="productos-buscar" label="Producto" wide>
        <FilterSearch id="productos-buscar" placeholder="Buscar por nombre o presentación..." value={search.value} onChange={search.setValue} />
      </FilterField>
      {areas && (
        <FilterField id="productos-rubro" label="Rubro">
          {/* Cambiar de rubro limpia el tipo: los tipos dependen del rubro. */}
          <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value, tipo: undefined })}>
            <SelectTrigger id="productos-rubro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los rubros</SelectItem>
              {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}{!area.active && ' (inactivo)'}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      )}
      <FilterField id="productos-tipo" label="Tipo">
        <Select value={tipo ?? ALL} disabled={types.length === 0} onValueChange={(value) => setFilters({ tipo: value === ALL ? undefined : value })}>
          <SelectTrigger id="productos-tipo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{types.length === 0 && areas ? 'Elegí un rubro' : 'Todos los tipos'}</SelectItem>
            {types.map((type) => <SelectItem key={type.key} value={type.key}>{type.label}{!type.active && ' (inactivo)'}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="productos-estado" label="Estado">
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="productos-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !rubro && !tipo && !estado} onClick={clear} />
    </FilterBar>
  )
}
