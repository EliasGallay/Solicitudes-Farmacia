'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type CloseItem = { id: string; name: string; presentation: string; requested: number; delivered: number; pending: number }

// Lista de productos a cerrar: buscador por nombre y marcar/desmarcar todos los visibles.
// Los checkboxes van con name="item", así que el formulario solo envía los marcados.
export function ClosePendingItems({ items }: { items: CloseItem[] }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((item) => item.id)))

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return term ? items.filter((item) => `${item.name} ${item.presentation}`.toLowerCase().includes(term)) : items
  }, [items, query])

  const visibleIds = useMemo(() => new Set(visible.map((item) => item.id)), [visible])
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.has(item.id))

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function setVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const item of visible) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input type="search" aria-label="Buscar producto a cerrar" placeholder="Buscar producto..." className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-foreground-secondary tabular-nums">{selected.size} de {items.length} marcados</span>
          <Button type="button" variant="ghost" size="sm" disabled={visible.length === 0} onClick={() => setVisible(!allVisibleSelected)}>
            {allVisibleSelected ? 'Desmarcar' : 'Marcar'} {query.trim() ? 'visibles' : 'todos'}
          </Button>
        </div>
      </div>

      {/* Todos los checkboxes siguen montados (el filtro solo los oculta): si se desmontaran, no se enviarían. */}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((item) => (
          <li key={item.id} className={cn(!visibleIds.has(item.id) && 'hidden')}>
            <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-hover">
              <input type="checkbox" name="item" value={item.id} checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="size-4 shrink-0 accent-primary-600" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold break-words">{item.name}</span>
                <span className="block text-xs text-foreground-secondary">{item.presentation} · Solicitado {item.requested} · Entregado {item.delivered}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg leading-6 font-bold text-warning tabular-nums">{item.pending}</span>
                <span className="text-xs text-foreground-secondary">a cerrar</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="text-sm text-foreground-secondary">No hay productos con esa búsqueda.</p>}
    </div>
  )
}
