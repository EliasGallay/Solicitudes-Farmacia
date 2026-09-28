'use client'

import { ClearFiltersButton, FilterBar, FilterField } from '@/components/filter-bar'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { auditActionLabels, auditActions } from '@/lib/audit'

const ALL = 'todos'

export function AuditFilters({ users, accion, usuario, desde, hasta }: { users: { id: string; name: string }[]; accion?: string; usuario?: string; desde?: string; hasta?: string }) {
  const { setFilters, clearFilters } = useUrlFilters()

  return (
    // La key remonta las fechas (no controladas) cuando cambian por URL, p. ej. al limpiar.
    <FilterBar key={`${desde}-${hasta}`}>
      <FilterField id="auditoria-accion" label="Acción">
        <Select value={accion ?? ALL} onValueChange={(value) => setFilters({ accion: value === ALL ? undefined : value })}>
          <SelectTrigger id="auditoria-accion"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las acciones</SelectItem>
            {auditActions.map((action) => <SelectItem key={action} value={action}>{auditActionLabels[action]}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="auditoria-usuario" label="Usuario">
        <Select value={usuario ?? ALL} onValueChange={(value) => setFilters({ usuario: value === ALL ? undefined : value })}>
          <SelectTrigger id="auditoria-usuario"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los usuarios</SelectItem>
            {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField id="auditoria-desde" label="Fecha desde">
        <Input id="auditoria-desde" type="date" className="min-w-0" defaultValue={desde} max={hasta} onChange={(event) => setFilters({ desde: event.target.value })} />
      </FilterField>
      <FilterField id="auditoria-hasta" label="Fecha hasta">
        <Input id="auditoria-hasta" type="date" className="min-w-0" defaultValue={hasta} min={desde} onChange={(event) => setFilters({ hasta: event.target.value })} />
      </FilterField>
      <ClearFiltersButton disabled={!accion && !usuario && !desde && !hasta} onClick={clearFilters} />
    </FilterBar>
  )
}
