'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { vehicleRequestStatuses, vehicleRequestStatusLabels } from '@/lib/fleet'

// Por defecto, las abiertas (sin ?estado=).
const OPEN = 'abiertas'
const ALL = 'todos'

export function VehicleRequestFilters({ buscar, estado, vehiculo, vehicles }: { buscar?: string; estado?: string; vehiculo?: string; vehicles: { id: string; label: string }[] }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="servicio-buscar" label="Solicitud" wide>
        <FilterSearch id="servicio-buscar" placeholder="Buscar por número, requerimiento, problema o vehículo..." value={search.value} onChange={search.setValue} />
      </FilterField>
      <FilterField id="servicio-estado" label="Estado">
        <Select value={estado ?? OPEN} onValueChange={(value) => setFilters({ estado: value === OPEN ? undefined : value })}>
          <SelectTrigger id="servicio-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={OPEN}>Abiertas</SelectItem>
            {vehicleRequestStatuses.map((status) => <SelectItem key={status} value={status}>{vehicleRequestStatusLabels[status]}</SelectItem>)}
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="servicio-vehiculo" label="Vehículo">
        <Select value={vehiculo ?? ALL} onValueChange={(value) => setFilters({ vehiculo: value === ALL ? undefined : value })}>
          <SelectTrigger id="servicio-vehiculo"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los vehículos</SelectItem>
            {vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !estado && !vehiculo} onClick={clear} />
    </FilterBar>
  )
}
