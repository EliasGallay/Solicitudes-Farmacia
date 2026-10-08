'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUrlFilters } from '@/hooks/use-url-filters'

const ALL = 'todas'
const readFilters = [
  { value: ALL, label: 'Todas' },
  { value: 'no-leidas', label: 'No leídas' },
] as const

export function NotificationFilters({ estado }: { estado?: 'no-leidas' }) {
  const { setFilters } = useUrlFilters()
  return (
    // Selección única obligatoria: se ignora el intento de deseleccionar la opción activa.
    <ToggleGroup type="single" aria-label="Filtrar notificaciones" value={estado ?? ALL} className="w-full sm:w-auto" onValueChange={(value) => value && setFilters({ estado: value === ALL ? undefined : value })}>
      {readFilters.map((filter) => <ToggleGroupItem key={filter.value} value={filter.value} className="flex-1 sm:flex-none">{filter.label}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
