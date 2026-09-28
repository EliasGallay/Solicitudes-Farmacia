'use client'

import { ClearFiltersButton, FilterBar, FilterField, FilterSearch } from '@/components/filter-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { roleLabels, userRoles } from '@/lib/users'

const ALL = 'todos'

export function UserFilters({ centers, buscar, rol, centro, estado }: { centers: { id: string; name: string }[]; buscar?: string; rol?: string; centro?: string; estado?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <FilterBar>
      <FilterField id="usuarios-buscar" label="Buscar" wide>
        <FilterSearch id="usuarios-buscar" placeholder="Nombre o email..." value={search.value} onChange={search.setValue} />
      </FilterField>
      <FilterField id="usuarios-rol" label="Rol">
        <Select value={rol ?? ALL} onValueChange={(value) => setFilters({ rol: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-rol"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los roles</SelectItem>
            {userRoles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="usuarios-centro" label="Centro">
        <Select value={centro ?? ALL} onValueChange={(value) => setFilters({ centro: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-centro"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los centros</SelectItem>
            {centers.map((center) => <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="usuarios-estado" label="Estado">
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
      <ClearFiltersButton disabled={!buscar && !rol && !centro && !estado} onClick={clear} />
    </FilterBar>
  )
}
