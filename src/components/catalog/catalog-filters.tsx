'use client'

import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <Card className="mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="flex flex-col gap-2 sm:col-span-2 lg:min-w-64 lg:flex-1">
        <Label htmlFor="catalogo-buscar">Producto</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input id="catalogo-buscar" type="search" placeholder="Buscar por nombre o presentación..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
        </div>
      </div>
      {areas && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="catalogo-rubro">Rubro</Label>
          {/* Cambiar de rubro limpia el tipo: los tipos dependen del rubro. */}
          <Select value={rubro ?? ALL} onValueChange={(value) => setFilters({ rubro: value === ALL ? undefined : value, tipo: undefined })}>
            <SelectTrigger id="catalogo-rubro" className="lg:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los rubros</SelectItem>
              {areas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="catalogo-tipo">Tipo</Label>
        <Select value={tipo ?? ALL} disabled={types.length === 0} onValueChange={(value) => setFilters({ tipo: value === ALL ? undefined : value })}>
          <SelectTrigger id="catalogo-tipo" className="lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{types.length === 0 && areas ? 'Elegí un rubro' : 'Todos los tipos'}</SelectItem>
            {types.map((type) => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button variant="secondary" className="self-end" disabled={!rubro && !buscar && !tipo} onClick={clear}><FilterX />Limpiar filtros</Button>
    </Card>
  )
}
