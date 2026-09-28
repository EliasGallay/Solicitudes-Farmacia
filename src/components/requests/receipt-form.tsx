'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, CheckCheck, LoaderCircle, PackageCheck, TriangleAlert } from 'lucide-react'
import { confirmReceipt } from '@/app/request-management-actions'
import { FormError } from '@/components/form-feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'
import { formatDateTime, formatDeliveryNumber } from '@/lib/requests'
import { cn } from '@/lib/utils'

export type ReceiptLine = { id: string; name: string; presentation: string; delivered: number }
export type ReceiptGroup = { deliveryId: string; number: number; createdAt: string; lines: ReceiptLine[] }

type LineState = { mark: '' | 'ok' | 'diferencia'; received: string; comment: string }

// Confirmación de recepción, producto por producto. Cada línea se marca "Recibido conforme" o "Con
// diferencia" (cantidad recibida + detalle obligatorio); las que no se marcan quedan para después.
export function ReceiptForm({ requestId, groups, cancelHref }: { requestId: string; groups: ReceiptGroup[]; cancelHref: string }) {
  const lines = groups.flatMap((group) => group.lines)
  const [states, setStates] = useState<Record<string, LineState>>(() => Object.fromEntries(lines.map((line) => [line.id, { mark: '', received: '', comment: '' }])))
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function update(id: string, patch: Partial<LineState>) {
    setStates((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  // Validación de una línea marcada con diferencia: recibido entre 0 y lo entregado − 1, comentario obligatorio.
  function differenceError(line: ReceiptLine, state: LineState) {
    if (state.mark !== 'diferencia') return undefined
    const value = Number(state.received)
    if (state.received === '' || !Number.isInteger(value) || value < 0 || value >= line.delivered) return `Ingresá la cantidad recibida: entre 0 y ${line.delivered - 1}.`
    if (!state.comment.trim()) return 'Describí la diferencia (faltante, producto dañado, vencido, etc.).'
    return undefined
  }

  const marked = lines.filter((line) => states[line.id]?.mark)
  const differences = marked.filter((line) => states[line.id].mark === 'diferencia')
  const invalid = marked.some((line) => differenceError(line, states[line.id]))

  function submit() {
    if (marked.length === 0 || invalid) return
    setError(undefined)
    setConfirming(true)
  }

  function confirm() {
    const payload = marked.map((line) => {
      const state = states[line.id]
      return state.mark === 'ok'
        ? { delivery_item_id: line.id, received_quantity: line.delivered }
        : { delivery_item_id: line.id, received_quantity: Number(state.received), comment: state.comment.trim() }
    })
    startTransition(async () => {
      const result = await confirmReceipt(requestId, payload)
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">Revisá cada producto al recibirlo. Lo que no marques queda para confirmar después.</p>
        <Button type="button" variant="secondary" size="sm" onClick={() => setStates((current) => Object.fromEntries(Object.entries(current).map(([id, state]) => [id, { ...state, mark: 'ok' }])))}>
          <CheckCheck />Marcar todo como recibido conforme
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.deliveryId} aria-labelledby={`remito-${group.deliveryId}`}>
            <h3 id={`remito-${group.deliveryId}`} className="mb-2 text-sm font-semibold text-foreground-secondary">
              Remito {formatDeliveryNumber(group.number)} · {formatDateTime(group.createdAt)}
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {group.lines.map((line) => {
                const state = states[line.id]
                const lineError = differenceError(line, state)
                return (
                  <li key={line.id} className={cn('flex flex-col gap-3 p-4', state.mark === 'ok' && 'bg-success-muted/40', state.mark === 'diferencia' && 'bg-warning-muted/40')}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words">{line.name}</p>
                        <p className="text-xs text-foreground-secondary">{line.presentation} · Entregado: <span className="font-semibold text-foreground tabular-nums">{line.delivered}</span></p>
                      </div>
                      <ToggleGroup type="single" value={state.mark} onValueChange={(value) => update(line.id, { mark: (value || '') as LineState['mark'] })} aria-label={`Recepción de ${line.name}`} className="shrink-0">
                        <ToggleGroupItem value="ok" className="data-[state=on]:border-success data-[state=on]:bg-success"><Check className="size-4" aria-hidden />Recibido conforme</ToggleGroupItem>
                        <ToggleGroupItem value="diferencia" className="data-[state=on]:border-warning data-[state=on]:bg-warning"><TriangleAlert className="size-4" aria-hidden />Con diferencia</ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {state.mark === 'diferencia' && (
                      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`recibido-${line.id}`}>Cantidad recibida</Label>
                          <Input id={`recibido-${line.id}`} type="number" inputMode="numeric" min={0} max={line.delivered - 1} step={1} value={state.received} onChange={(event) => update(line.id, { received: event.target.value })} aria-invalid={Boolean(lineError) && state.received !== ''} className="tabular-nums" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`comentario-${line.id}`}>Detalle de la diferencia</Label>
                          <Textarea id={`comentario-${line.id}`} maxLength={NOTE_MAX_LENGTH} className="min-h-10" placeholder="Ej.: faltan 2 cajas; 1 unidad dañada." value={state.comment} onChange={(event) => update(line.id, { comment: event.target.value })} />
                        </div>
                        {lineError && <p className="text-xs text-danger sm:col-span-2">{lineError}</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <FormError>{error}</FormError>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground-secondary" aria-live="polite">
          {marked.length === 0
            ? 'Ningún producto marcado.'
            : <><span className="font-semibold text-foreground">{marked.length} de {lines.length}</span> {lines.length === 1 ? 'producto marcado' : 'productos marcados'}{differences.length > 0 && <>, <span className="font-semibold text-warning">{differences.length} con diferencia</span></>}.</>}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href={cancelHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
          <Button type="submit" disabled={pending || marked.length === 0 || invalid}>
            {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />Confirmando...</> : <><PackageCheck />Confirmar recepción</>}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        icon={PackageCheck}
        title="Confirmar recepción"
        description={
          <>
            {differences.length > 0
              ? 'Las diferencias informadas serán revisadas por la administración, que resolverá el reenvío o el cierre del faltante. Lo confirmado no se puede modificar.'
              : 'Se registra la recepción conforme de los productos marcados. Lo confirmado no se puede modificar.'}
            {marked.length < lines.length && <span className="mt-2 block font-semibold text-foreground">{lines.length - marked.length === 1 ? 'Queda 1 producto sin confirmar.' : `Quedan ${lines.length - marked.length} productos sin confirmar.`}</span>}
          </>
        }
        confirmLabel={pending ? 'Confirmando...' : 'Confirmar'}
      />
    </form>
  )
}
