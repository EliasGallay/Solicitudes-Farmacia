'use client'

import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { productTypeLabels, productTypes, type ProductType } from '@/lib/product-types'

const ALL = 'todos'

export function CatalogFilters({ buscar, tipo }: { buscar?: string; tipo?: ProductType }) {
  const { setFilters, clearFilters } = useUrlFilters()
  const search = useSearchFilter('buscar', buscar)

  function clear() {
    search.reset()
    clearFilters()
  }

  return (
    <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
      <div className="flex min-w-64 flex-1 flex-col gap-2">
        <Label htmlFor="catalogo-buscar">Producto</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input id="catalogo-buscar" type="search" placeholder="Buscar por nombre o presentación..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="catalogo-tipo">Tipo</Label>
        <Select value={tipo ?? ALL} onValueChange={(value) => setFilters({ tipo: value === ALL ? undefined : value })}>
          <SelectTrigger id="catalogo-tipo" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {productTypes.map((type) => <SelectItem key={type} value={type}>{productTypeLabels[type]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button variant="secondary" disabled={!buscar && !tipo} onClick={clear}><FilterX />Limpiar filtros</Button>
    </Card>
  )
}
