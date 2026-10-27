'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { CenterDot } from '@/components/center-badge'
import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import type { Area } from '@/lib/areas'
import { requestStatusLabels, requestStatuses, statusViewLabels, type StatusView } from '@/lib/request-status'
import { cn } from '@/lib/utils'

const ALL = 'todos'
const INBOX = 'por_atender'

// `areas`: solo cuando el usuario ve más de un rubro; si no, el filtro de rubro no se muestra.
// `centers`: solo para el admin, con el color de cada centro (centerTone).
// `inbox`: bandeja del admin. Sin ?estado= muestra "Por atender"; "Todos los estados" es ?estado=todos.
export function RequestFilters({ inbox = false, areas, centers, rubro, centro, buscar, desde, hasta, estado }: { inbox?: boolean; areas?: Area[]; centers?: { id: string; name: string; tone: number }[]; rubro?: string; centro?: string; buscar?: string; desde?: string; hasta?: string; estado?: StatusView }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  // Debajo de md solo se ve la búsqueda; el resto de los filtros se despliega con el botón de al lado.
  const [open, setOpen] = useState(false)
  const activeFilters = [estado, centro, rubro, desde, hasta].filter(Boolean).length

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <>
      <div className="mb-4 flex gap-3 md:hidden">
        <FilterSearch id="filtro-buscar-mobile" ariaLabel="Buscar solicitudes" placeholder="Buscar solicitudes..." value={search.value} onChange={search.setValue} className="flex-1" />
        <Button variant="secondary" size="icon" className="relative shrink-0" aria-expanded={open} aria-controls="filtros-solicitudes" aria-label={activeFilters ? `Filtros (${activeFilters} aplicados)` : 'Filtros'} onClick={() => setOpen(!open)}>
          <SlidersHorizontal />
          {activeFilters > 0 && <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{activeFilters}</span>}
        </Button>
      </div>
      {/* La key remonta las fechas (no controladas) cuando cambian por URL, p. ej. al limpiar. */}
      <FilterBar id="filtros-solicitudes" key={`${desde}-${hasta}`} className={cn(!open && 'max-md:hidden')}>
        <FilterField id="filtro-buscar" label="Buscar" wide className="max-md:hidden">
          <FilterSearch id="filtro-buscar" placeholder="N° de solicitud, requerimiento o producto..." value={search.value} onChange={search.setValue} />
        </FilterField>
        <FilterField id="filtro-estado" label="Estado">
          <Select value={estado ?? (inbox ? INBOX : ALL)} onValueChange={(value) => setFilters({ estado: value === (inbox ? INBOX : ALL) ? undefined : value === ALL ? 'todos' : value })}>
            <SelectTrigger id="filtro-estado" data-tour="requests-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {inbox && <SelectItem value={INBOX}>{statusViewLabels.por_atender}</SelectItem>}
              <SelectItem value={inbox ? 'todos' : ALL}>Todos los estados</SelectItem>
              {requestStatuses.map((status) => <SelectItem key={status} value={status}>{requestStatusLabels[status]}</SelectItem>)}
              <SelectItem value="por_confirmar">{statusViewLabels.por_confirmar}</SelectItem>
              <SelectItem value="con_diferencia">{statusViewLabels.con_diferencia}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        {centers && (
          <FilterField id="filtro-centro" label="Centro de salud">
            <Select value={centro ?? ALL} onValueChange={(value) => setFilters({ centro: value === ALL ? undefined : value })}>
              <SelectTrigger id="filtro-centro"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los centros</SelectItem>
                {centers.map((center) => <SelectItem key={center.id} value={center.id}><span className="flex items-center gap-2"><CenterDot tone={center.tone} />{center.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
        )}
        {areas && (
          <FilterField id="filtro-rubro" label="Rubro">
            <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value })}>
              <SelectTrigger id="filtro-rubro"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los rubros</SelectItem>
                {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterField>
        )}
        <FilterField id="filtro-desde" label="Fecha desde">
          <Input id="filtro-desde" type="date" className="min-w-0" defaultValue={desde} max={hasta} onChange={(event) => setFilters({ desde: event.target.value })} />
        </FilterField>
        <FilterField id="filtro-hasta" label="Fecha hasta">
          <Input id="filtro-hasta" type="date" className="min-w-0" defaultValue={hasta} min={desde} onChange={(event) => setFilters({ hasta: event.target.value })} />
        </FilterField>
        <ClearFiltersButton disabled={!rubro && !centro && !buscar && !desde && !hasta && !estado} onClick={clear} />
      </FilterBar>
    </>
  )
}
