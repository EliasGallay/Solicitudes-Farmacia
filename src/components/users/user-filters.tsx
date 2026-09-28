'use client'

import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <Card className="mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="flex flex-col gap-2 sm:col-span-2 lg:min-w-56 lg:flex-1">
        <Label htmlFor="usuarios-buscar">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input id="usuarios-buscar" type="search" placeholder="Nombre o email..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="usuarios-rol">Rol</Label>
        <Select value={rol ?? ALL} onValueChange={(value) => setFilters({ rol: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-rol" className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los roles</SelectItem>
            {userRoles.map((role) => <SelectItem key={role} value={role}>{roleLabels[role]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="usuarios-centro">Centro</Label>
        <Select value={centro ?? ALL} onValueChange={(value) => setFilters({ centro: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-centro" className="lg:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los centros</SelectItem>
            {centers.map((center) => <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="usuarios-estado">Estado</Label>
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="usuarios-estado" className="lg:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="secondary" className="self-end" disabled={!buscar && !rol && !centro && !estado} onClick={clear}><FilterX />Limpiar filtros</Button>
    </Card>
  )
}
