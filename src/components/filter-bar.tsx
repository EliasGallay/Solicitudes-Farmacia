import type { ReactNode } from 'react'
import { FilterX, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Barra de filtros de los listados. Se acomoda al ancho de la propia card (container queries) y no al
// de la pantalla: desde lg el sidebar ocupa parte del ancho, así que el viewport no alcanza para
// decidir. Cada filtro ocupa una columna de al menos 9.5rem y entran tantas como quepan; las filas
// quedan alineadas en una grilla en lugar de cortarse con anchos fijos.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="@container mb-6 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9.5rem),1fr))] items-end gap-3">{children}</div>
    </Card>
  )
}

// `wide`: ocupa dos columnas cuando hay lugar (la búsqueda de texto).
export function FilterField({ id, label, wide = false, children }: { id: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'col-span-full @md:col-span-2')}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

// Campo de búsqueda con ícono, para usar dentro de un FilterField `wide`.
export function FilterSearch({ id, placeholder, value, onChange }: { id: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
      <Input id={id} type="search" placeholder={placeholder} className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

// Último elemento de la barra: alineado con los controles, ocupa su propia columna.
export function ClearFiltersButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <Button variant="secondary" className="w-full" disabled={disabled} onClick={onClick}><FilterX />Limpiar filtros</Button>
}
