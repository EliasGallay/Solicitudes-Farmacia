'use client'

import { CenterDot } from '@/components/center-badge'
import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import type { Area } from '@/lib/areas'

const ALL = 'todos'

// `areas`: solo con más de un rubro.
export function DeliveryFilters({ areas, centers, buscar, centro, rubro, estado, desde, hasta }: { areas?: Area[]; centers: { id: string; name: string; tone: number }[]; buscar?: string; centro?: string; rubro?: string; estado?: string; desde?: string; hasta?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    // La key remonta las fechas (no controladas) cuando cambian por URL, p. ej. al limpiar.
    <FilterBar key={`${desde}-${hasta}`}>
      <FilterField id="entregas-buscar" label="Buscar" wide>
        <FilterSearch id="entregas-buscar" placeholder="N° de remito o SOL-n° de solicitud..." value={search.value} onChange={search.setValue} />
      </FilterField>
      <FilterField id="entregas-centro" label="Centro de salud">
        <Select value={centro ?? ALL} onValueChange={(value) => setFilters({ centro: value === ALL ? undefined : value })}>
          <SelectTrigger id="entregas-centro"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los centros</SelectItem>
            {centers.map((center) => <SelectItem key={center.id} value={center.id}><span className="flex items-center gap-2"><CenterDot tone={center.tone} />{center.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      {areas && (
        <FilterField id="entregas-rubro" label="Rubro">
          <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value })}>
            <SelectTrigger id="entregas-rubro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los rubros</SelectItem>
              {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      )}
      <FilterField id="entregas-estado" label="Estado">
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="entregas-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            <SelectItem value="activa">Entregadas</SelectItem>
            <SelectItem value="anulada">Anuladas</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="entregas-desde" label="Fecha desde">
        <Input id="entregas-desde" type="date" className="min-w-0" defaultValue={desde} max={hasta} onChange={(event) => setFilters({ desde: event.target.value })} />
      </FilterField>
      <FilterField id="entregas-hasta" label="Fecha hasta">
        <Input id="entregas-hasta" type="date" className="min-w-0" defaultValue={hasta} min={desde} onChange={(event) => setFilters({ hasta: event.target.value })} />
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !centro && !rubro && !estado && !desde && !hasta} onClick={clear} />
    </FilterBar>
  )
}
