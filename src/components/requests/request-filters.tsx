'use client'

import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { requestStatusLabels, requestStatuses, type RequestStatus } from '@/lib/request-status'

const ALL = 'todos'

export function RequestFilters({ buscar, desde, hasta, estado }: { buscar?: string; desde?: string; hasta?: string; estado?: RequestStatus }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <Card key={`${desde}-${hasta}`} className="mb-6 flex flex-wrap items-end gap-4 p-4">
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="filtro-buscar">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input id="filtro-buscar" type="search" placeholder="N° de solicitud o producto..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="filtro-estado">Estado</Label>
        <Select value={estado ?? ALL} onValueChange={(value) => setFilters({ estado: value === ALL ? undefined : value })}>
          <SelectTrigger id="filtro-estado" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {requestStatuses.map((status) => <SelectItem key={status} value={status}>{requestStatusLabels[status]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="filtro-desde">Fecha desde</Label>
        <Input id="filtro-desde" type="date" className="w-44" defaultValue={desde} max={hasta} onChange={(event) => setFilters({ desde: event.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="filtro-hasta">Fecha hasta</Label>
        <Input id="filtro-hasta" type="date" className="w-44" defaultValue={hasta} min={desde} onChange={(event) => setFilters({ hasta: event.target.value })} />
      </div>
      <Button variant="secondary" disabled={!buscar && !desde && !hasta && !estado} onClick={clear}><FilterX />Limpiar filtros</Button>
    </Card>
  )
}
