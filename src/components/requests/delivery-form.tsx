'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { LoaderCircle, Truck } from 'lucide-react'
import { registerDelivery } from '@/app/request-management-actions'
import { FormError } from '@/components/form-feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileList, MobileListFields, MobileListHeader, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'

export type DeliveryFormItem = { id: string; name: string; presentation: string; requested: number; delivered: number; pending: number }

// Cantidades precargadas con el pendiente de cada producto: lo habitual es entregar todo.
// Se puede bajar cualquier cantidad o dejarla en 0 para no entregar ese producto ahora.
export function DeliveryForm({ requestId, items, cancelHref }: { requestId: string; items: DeliveryFormItem[]; cancelHref: string }) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, String(item.pending)])))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const parsed = items.map((item) => {
    const raw = quantities[item.id] ?? ''
    const value = Number(raw)
    const valid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= item.pending
    return { item, value: valid ? value : 0, valid }
  })
  const invalid = parsed.some((line) => !line.valid)
  const selected = parsed.filter((line) => line.value > 0)
  const units = selected.reduce((total, line) => total + line.value, 0)

  function setAll(fill: boolean) {
    setQuantities(Object.fromEntries(items.map((item) => [item.id, fill ? String(item.pending) : '0'])))
  }

  // El envío pide confirmación; el diálogo queda abierto (y bloqueado) mientras se registra.
  function submit() {
    if (invalid || selected.length === 0) return
    setError(undefined)
    setConfirming(true)
  }

  function confirm() {
    startTransition(async () => {
      const result = await registerDelivery(requestId, parsed.map((line) => ({ request_item_id: line.item.id, quantity: line.value })), note)
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  function quantityInput(item: DeliveryFormItem, valid: boolean) {
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={item.pending}
        step={1}
        aria-label={`Cantidad a entregar de ${item.name}`}
        aria-invalid={!valid}
        value={quantities[item.id] ?? ''}
        onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
        className="w-24 text-right tabular-nums"
      />
    )
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">Las cantidades empiezan con todo lo pendiente. Poné 0 en lo que no entregás ahora.</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll(true)}>Todo lo pendiente</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false)}>Todo en 0</Button>
        </div>
      </div>

      <MobileList>
        {parsed.map(({ item, valid }) => (
          <MobileListItem key={item.id}>
            <MobileListHeader title={item.name} subtitle={item.presentation} />
            <MobileListFields fields={[
              { label: 'Solicitado', value: item.requested },
              { label: 'Entregado', value: item.delivered },
              { label: 'Pendiente', value: item.pending, className: 'text-warning' },
            ]} />
            <div className="flex items-center justify-between gap-3">
              <Label>A entregar</Label>
              {quantityInput(item, valid)}
            </div>
            {!valid && <p className="text-xs text-danger">Ingresá un número entre 0 y {item.pending}.</p>}
          </MobileListItem>
        ))}
      </MobileList>
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Solicitado</TableHead>
            <TableHead className="text-right">Entregado</TableHead>
            <TableHead className="text-right">Pendiente</TableHead>
            <TableHead className="text-right">A entregar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parsed.map(({ item, valid }) => (
            <TableRow key={item.id}>
              <TableCell>
                <span className="font-semibold">{item.name}</span>
                <span className="block text-xs leading-4 text-foreground-secondary">{item.presentation}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{item.requested}</TableCell>
              <TableCell className="text-right tabular-nums">{item.delivered}</TableCell>
              <TableCell className="text-right font-semibold text-warning tabular-nums">{item.pending}</TableCell>
              <TableCell>
                <div className="flex flex-col items-end gap-1">
                  {quantityInput(item, valid)}
                  {!valid && <span className="text-xs text-danger">Entre 0 y {item.pending}</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-6 flex flex-col gap-2">
        <Label htmlFor="entrega-nota">Nota <span className="font-normal text-foreground-secondary">(opcional)</span></Label>
        <Textarea id="entrega-nota" maxLength={NOTE_MAX_LENGTH} placeholder="Ej.: se envía con el móvil de la tarde, faltante de ibuprofeno a reponer la próxima semana..." value={note} onChange={(event) => setNote(event.target.value)} />
      </div>

      <FormError>{error}</FormError>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-secondary" aria-live="polite">
          {selected.length === 0 ? 'Ningún producto con cantidad a entregar.' : <>Se entregan <span className="font-semibold text-foreground">{units} {units === 1 ? 'unidad' : 'unidades'}</span> de {selected.length} {selected.length === 1 ? 'producto' : 'productos'}.</>}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href={cancelHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
          <Button type="submit" disabled={pending || invalid || selected.length === 0}>
            {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />Registrando...</> : <><Truck />Registrar entrega</>}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        icon={Truck}
        title="Registrar entrega"
        description="Se genera el remito y estas cantidades dejan de figurar como pendientes."
        confirmLabel={pending ? 'Registrando...' : 'Registrar entrega'}
      />
    </form>
  )
}
