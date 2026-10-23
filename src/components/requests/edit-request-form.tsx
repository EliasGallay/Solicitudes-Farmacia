'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { LoaderCircle, Pencil, Plus, Search, X } from 'lucide-react'
import { editRequest } from '@/app/request-management-actions'
import { FormError } from '@/components/form-feedback'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileList, MobileListFields, MobileListHeader, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useSearchFilter } from '@/hooks/use-url-filters'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'
import { cn } from '@/lib/utils'

// `minimum`: lo ya entregado + cerrado; la cantidad solicitada no puede bajar de ahí (ni de 1).
export type EditFormItem = { id: string; name: string; presentation: string; requested: number; delivered: number; closed: number; minimum: number }
export type EditFormProduct = { id: string; name: string; presentation: string }

type AddedProduct = EditFormProduct & { quantity: string }

function parseQuantity(raw: string, minimum: number) {
  const value = Number(raw)
  const valid = raw !== '' && Number.isInteger(value) && value >= minimum
  return { value, valid }
}

// Corrección de una solicitud (admin): cambiar cantidades y agregar productos del rubro, con motivo
// obligatorio. `products` llega ya filtrado por el servidor según `buscar`; lo cargado se conserva
// entre búsquedas.
export function EditRequestForm({ requestId, items, products, buscar, cancelHref }: { requestId: string; items: EditFormItem[]; products: EditFormProduct[]; buscar?: string; cancelHref: string }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, String(item.requested)])))
  const [added, setAdded] = useState<AddedProduct[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const search = useSearchFilter('buscar', buscar)

  const lines = items.map((item) => {
    const minimum = Math.max(item.minimum, 1)
    return { item, minimum, ...parseQuantity(quantities[item.id] ?? '', minimum) }
  })
  const addedLines = added.map((product) => ({ product, ...parseQuantity(product.quantity, 1) }))
  const changed = lines.filter((line) => line.valid && line.value !== line.item.requested)
  const invalid = lines.some((line) => !line.valid) || addedLines.some((line) => !line.valid)
  const changeCount = changed.length + addedLines.length
  const missingReason = reason.trim() === ''
  const addedIds = new Set(added.map((product) => product.id))
  const results = products.filter((product) => !addedIds.has(product.id))

  function add(product: EditFormProduct) {
    setAdded((current) => [...current, { ...product, quantity: '1' }])
  }

  function submit() {
    if (invalid || changeCount === 0 || missingReason) return
    setError(undefined)
    setConfirming(true)
  }

  function confirm() {
    startTransition(async () => {
      const changes = [
        ...changed.map((line) => ({ request_item_id: line.item.id, quantity: line.value })),
        ...addedLines.map((line) => ({ product_id: line.product.id, quantity: line.value })),
      ]
      const result = await editRequest(requestId, changes, reason)
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  function quantityInput(id: string, label: string, value: string, minimum: number, valid: boolean, onChange: (value: string) => void) {
    return (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={minimum}
        step={1}
        aria-label={label}
        aria-invalid={!valid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-24 text-right tabular-nums"
      />
    )
  }

  const setItemQuantity = (id: string) => (value: string) => setQuantities((current) => ({ ...current, [id]: value }))
  const setAddedQuantity = (id: string) => (value: string) => setAdded((current) => current.map((product) => product.id === id ? { ...product, quantity: value } : product))
  const removeAdded = (id: string) => setAdded((current) => current.filter((product) => product.id !== id))
  const minimumHint = (minimum: number) => minimum > 1 ? `Mínimo ${minimum} (ya entregado o cerrado)` : 'Entero desde 1'

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }}>
      <p className="mb-4 text-sm text-foreground-secondary">Cambiá la cantidad solicitada o agregá productos. La cantidad no puede bajar de lo ya entregado o cerrado.</p>

      <MobileList>
        {lines.map(({ item, minimum, valid }) => (
          <MobileListItem key={item.id}>
            <MobileListHeader title={item.name} subtitle={item.presentation} />
            <MobileListFields fields={[
              { label: 'Solicitado', value: item.requested },
              { label: 'Entregado', value: item.delivered },
              { label: 'Cerrado', value: item.closed },
            ]} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`m-cantidad-${item.id}`}>Nueva cantidad</Label>
              {quantityInput(`m-cantidad-${item.id}`, `Nueva cantidad de ${item.name}`, quantities[item.id] ?? '', minimum, valid, setItemQuantity(item.id))}
            </div>
            {!valid && <p className="text-xs text-danger">{minimumHint(minimum)}.</p>}
          </MobileListItem>
        ))}
        {addedLines.map(({ product, valid }) => (
          <MobileListItem key={product.id}>
            <MobileListHeader title={product.name} subtitle={product.presentation} aside={<Badge variant="info">Nuevo</Badge>} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`m-agregado-${product.id}`}>Cantidad</Label>
              <div className="flex items-center gap-1">
                {quantityInput(`m-agregado-${product.id}`, `Cantidad de ${product.name}`, product.quantity, 1, valid, setAddedQuantity(product.id))}
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${product.name}`} onClick={() => removeAdded(product.id)}><X /></Button>
              </div>
            </div>
            {!valid && <p className="text-xs text-danger">Entero desde 1.</p>}
          </MobileListItem>
        ))}
      </MobileList>
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Solicitado</TableHead>
            <TableHead className="text-right">Entregado</TableHead>
            <TableHead className="text-right">Cerrado</TableHead>
            <TableHead className="text-right">Nueva cantidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(({ item, minimum, valid }) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="font-semibold">{item.name}</span>
                <span className="block text-xs leading-4 text-foreground-secondary">{item.presentation}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.requested}</TableCell>
              <TableCell className="text-right tabular-nums">{item.delivered}</TableCell>
              <TableCell className="text-right tabular-nums">{item.closed}</TableCell>
              <TableCell>
                <div className="flex flex-col items-end gap-1">
                  {quantityInput(`cantidad-${item.id}`, `Nueva cantidad de ${item.name}`, quantities[item.id] ?? '', minimum, valid, setItemQuantity(item.id))}
                  {!valid && <span className="text-xs text-danger">{minimumHint(minimum)}</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {addedLines.map(({ product, valid }) => (
            <TableRow key={product.id}>
              <TableCell>
                <span className="flex flex-wrap items-center gap-2 font-semibold">{product.name}<Badge variant="info">Nuevo</Badge></span>
                <span className="block text-xs leading-4 text-foreground-secondary">{product.presentation}</span>
              </TableCell>
              <TableCell className="text-right text-foreground-secondary">—</TableCell>
              <TableCell className="text-right text-foreground-secondary">—</TableCell>
              <TableCell className="text-right text-foreground-secondary">—</TableCell>
              <TableCell>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${product.name}`} onClick={() => removeAdded(product.id)}><X /></Button>
                    {quantityInput(`agregado-${product.id}`, `Cantidad de ${product.name}`, product.quantity, 1, valid, setAddedQuantity(product.id))}
                  </div>
                  {!valid && <span className="text-xs text-danger">Entero desde 1</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <section aria-labelledby="agregar-productos" className="mt-6 flex flex-col gap-3 border-t border-border pt-5">
        <h3 id="agregar-productos" className="text-base font-semibold">Agregar productos</h3>
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input type="search" aria-label="Buscar producto del rubro" placeholder="Buscar producto del rubro..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
        </div>
        {results.length > 0 ? (
          <ul aria-busy={search.pending} className={cn('divide-y divide-border rounded-lg border border-border transition-opacity', search.pending && 'opacity-60')}>
            {results.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{product.name}</span>
                  <span className="block truncate text-xs text-foreground-secondary">{product.presentation}</span>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => add(product)}><Plus />Agregar</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground-secondary">{buscar ? 'No hay otros productos del rubro con esa búsqueda.' : 'Todos los productos del rubro ya están en la solicitud.'}</p>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-2">
        <Label htmlFor="edicion-motivo">Motivo</Label>
        <Textarea id="edicion-motivo" required maxLength={NOTE_MAX_LENGTH} placeholder="Ej.: el centro pidió 500 por error, eran 50; se agrega Platsul que faltaba en el pedido..." value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>

      <FormError>{error}</FormError>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-secondary" aria-live="polite">
          {changeCount === 0 ? 'Sin cambios todavía.' : <>Se {changeCount === 1 ? 'corrige' : 'corrigen'} <span className="font-semibold text-foreground">{changeCount} {changeCount === 1 ? 'producto' : 'productos'}</span>{missingReason && '. Falta el motivo'}.</>}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href={cancelHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
          <Button type="submit" disabled={pending || invalid || changeCount === 0 || missingReason}>
            {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />Guardando...</> : <><Pencil />Guardar cambios</>}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        icon={Pencil}
        title="Corregir solicitud"
        description="Las cantidades solicitadas se actualizan y el cambio queda en el historial y en la auditoría con el motivo."
        confirmLabel={pending ? 'Guardando...' : 'Guardar cambios'}
      />
    </form>
  )
}
