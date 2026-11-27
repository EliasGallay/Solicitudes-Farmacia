'use client'

import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Filtros de la tabla de personal. El estado vive en la URL: la búsqueda se aplica al escribir
// (con pausa corta) y profesión, CAPS y estado se aplican al elegir una opción.

export type FilterOption = { value: string; label: string }

// Radix no admite valores vacíos en los items: «todas» / «todos» representan «sin filtro».
const ALL = 'todos'

export function StaffFilters({
  q,
  profesion,
  centro,
  estado,
  professions,
  centers,
}: {
  q?: string
  profesion?: string
  centro?: string
  estado: string
  professions: string[]
  centers: FilterOption[]
}) {
  const search = useSearchFilter('q', q)
  const { setFilters } = useUrlFilters()

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="grid gap-1.5 lg:w-72">
        <Label htmlFor="staff-search">Buscar por nombre</Label>
        <Input
          id="staff-search"
          type="search"
          placeholder="Apellido o nombre"
          value={search.value}
          onChange={(event) => search.setValue(event.target.value)}
        />
      </div>

      <div className="grid gap-1.5 lg:w-56">
        <Label htmlFor="staff-profesion">Profesión</Label>
        <Select value={profesion ?? ALL} onValueChange={(value) => setFilters({ profesion: value === ALL ? undefined : value })}>
          <SelectTrigger id="staff-profesion"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {professions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 lg:w-56">
        <Label htmlFor="staff-centro">CAPS</Label>
        <Select value={centro ?? ALL} onValueChange={(value) => setFilters({ centro: value === ALL ? undefined : value })}>
          <SelectTrigger id="staff-centro"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {centers.map((center) => <SelectItem key={center.value} value={center.value}>{center.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5 lg:w-48">
        <Label htmlFor="staff-estado">Estado</Label>
        <Select value={estado} onValueChange={(value) => setFilters({ estado: value === 'activo' ? undefined : value })}>
          <SelectTrigger id="staff-estado"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Dados de baja</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
