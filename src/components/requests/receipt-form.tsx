'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, CheckCheck, CircleCheck, LoaderCircle, PackageCheck, PackageX, Paperclip, TriangleAlert } from 'lucide-react'
import { confirmReceipt, confirmReceiptWithSignedNote } from '@/app/request-management-actions'
import { SignedNoteInput } from '@/components/deliveries/signed-note-input'
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

type LineState = { mark: '' | 'ok' | 'diferencia' | 'equivocado'; received: string; comment: string }

// Confirmación de recepción, producto por producto. Cada línea se marca "Recibido conforme", "Con
// diferencia" (cantidad recibida + detalle obligatorio) o "Producto equivocado" (llegó otra cosa: recibido
// 0 + qué llegó, obligatorio); las que no se marcan quedan para después.
// Con `signedNote`, lo usa el admin en /entregas/[id]/recibir: confirma las líneas de esa entrega con la
// foto del remito firmado por el centro (obligatoria salvo que la entrega ya tenga `existing` remitos) o
// solo adjunta el remito, sin marcar líneas.
export function ReceiptForm({ requestId, groups, cancelHref, signedNote }: { requestId: string; groups: ReceiptGroup[]; cancelHref: string; signedNote?: { deliveryId: string; existing: number } }) {
  const lines = groups.flatMap((group) => group.lines)
  const [file, setFile] = useState<File | null>(null)
  const [states, setStates] = useState<Record<string, LineState>>(() => Object.fromEntries(lines.map((line) => [line.id, { mark: '', received: '', comment: '' }])))
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function update(id: string, patch: Partial<LineState>) {
    setStates((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  // Diferencia: recibido entre 0 y lo entregado − 1, comentario obligatorio. Producto equivocado: detalle obligatorio.
  function differenceError(line: ReceiptLine, state: LineState) {
    if (state.mark === 'equivocado') return state.comment.trim() ? undefined : 'Indicá qué producto llegó en lugar del entregado.'
    if (state.mark !== 'diferencia') return undefined
    const value = Number(state.received)
    if (state.received === '' || !Number.isInteger(value) || value < 0 || value >= line.delivered) return `Ingresá la cantidad recibida: entre 0 y ${line.delivered - 1}.`
    if (!state.comment.trim()) return 'Describí la diferencia (faltante, producto dañado, vencido, etc.).'
    return undefined
  }

  const marked = lines.filter((line) => states[line.id]?.mark)
  const differences = marked.filter((line) => states[line.id].mark === 'diferencia')
  const wrongProducts = marked.filter((line) => states[line.id].mark === 'equivocado')
  const invalid = marked.some((line) => differenceError(line, states[line.id]))
  // Admin: para confirmar hace falta un remito (el nuevo o uno anterior); sin líneas marcadas, solo se adjunta.
  const missingNote = Boolean(signedNote) && !file && (marked.length > 0 ? signedNote!.existing === 0 : true)
  const attachOnly = Boolean(signedNote) && marked.length === 0 && Boolean(file)
  const canSubmit = (marked.length > 0 || attachOnly) && !invalid && !missingNote
  const emptyText = signedNote && lines.length === 0 ? 'Todos los productos de la entrega ya están confirmados.' : attachOnly ? 'Ningún producto marcado: solo se adjunta el remito.' : 'Ningún producto marcado.'

  function submit() {
    if (!canSubmit) return
    setError(undefined)
    setConfirming(true)
  }

  function confirm() {
    const payload = marked.map((line) => {
      const state = states[line.id]
      if (state.mark === 'ok') return { delivery_item_id: line.id, received_quantity: line.delivered }
      if (state.mark === 'equivocado') return { delivery_item_id: line.id, received_quantity: 0, comment: state.comment.trim(), wrong_product: true }
      return { delivery_item_id: line.id, received_quantity: Number(state.received), comment: state.comment.trim() }
    })
    startTransition(async () => {
      let result: { error: string } | undefined
      if (signedNote) {
        const formData = new FormData()
        if (file) formData.set('file', file)
        result = await confirmReceiptWithSignedNote(signedNote.deliveryId, payload, formData)
      } else {
        result = await confirmReceipt(requestId, payload)
      }
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
      }
    })
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }}>
      {signedNote && (
        <section aria-labelledby="remito-firmado" className="mb-6 flex flex-col gap-2">
          <h3 id="remito-firmado" className="text-sm font-semibold">Remito firmado por el centro</h3>
          <p className="text-sm text-foreground-secondary">
            {signedNote.existing > 0
              ? `La entrega ya tiene ${signedNote.existing === 1 ? '1 remito firmado adjunto' : `${signedNote.existing} remitos firmados adjuntos`}. Podés sumar otro (por ejemplo, otra hoja) o confirmar sin adjuntar.`
              : 'Sacale una foto al remito con la firma del centro: queda como constancia de la recepción.'}
          </p>
          <SignedNoteInput value={file} onChange={setFile} disabled={pending} />
        </section>
      )}
      {lines.length > 0 && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground-secondary">Lo que no marques queda para confirmar después.</p>
        {/* Solo completa lo que falta marcar: no pisa las diferencias ya cargadas. */}
        <Button data-tour="receipt-mark-all" type="button" variant="secondary" size="sm" onClick={() => setStates((current) => Object.fromEntries(Object.entries(current).map(([id, state]) => [id, state.mark ? state : { ...state, mark: 'ok' }])))}>
          <CheckCheck />Marcar todo como recibido conforme
        </Button>
      </div>}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.deliveryId} aria-labelledby={`remito-${group.deliveryId}`}>
            <h3 id={`remito-${group.deliveryId}`} className="mb-2 rounded-md bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground-secondary">
              Remito {formatDeliveryNumber(group.number)} · {formatDateTime(group.createdAt)}
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {group.lines.map((line) => {
                const state = states[line.id]
                const lineError = differenceError(line, state)
                return (
                  // Borde izquierdo y fondo del color del estado elegido: se distingue de un vistazo qué falta marcar.
                  <li key={line.id} className={cn('flex flex-col gap-3 border-l-4 border-l-transparent p-4 transition-colors first:rounded-tl-lg last:rounded-bl-lg', state.mark === 'ok' && 'border-l-success bg-success-muted/40', state.mark === 'diferencia' && 'border-l-warning bg-warning-muted/40', state.mark === 'equivocado' && 'border-l-danger bg-danger-muted/40')}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold break-words">{line.name}</p>
                        <p className="text-xs text-foreground-secondary">{line.presentation} · Entregado: <span className="font-semibold text-foreground tabular-nums">{line.delivered}</span></p>
                      </div>
                      {/* Cada opción lleva su color e ícono también sin elegir; elegida, fondo suave y borde del
                          mismo color (legible en ambos temas, a diferencia de texto blanco sobre el color). */}
                      <ToggleGroup data-tour={line.id === lines[0]?.id ? 'receipt-options' : undefined} type="single" value={state.mark} onValueChange={(value) => update(line.id, { mark: (value || '') as LineState['mark'] })} aria-label={`Recepción de ${line.name}`} className="shrink-0 flex-wrap">
                        <ToggleGroupItem value="ok" className="text-foreground hover:border-success hover:bg-success-muted/50 data-[state=on]:border-success data-[state=on]:bg-success-muted data-[state=on]:text-success data-[state=on]:ring-1 data-[state=on]:ring-success [&_svg]:text-success">
                          {state.mark === 'ok' ? <CircleCheck className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}Recibido conforme
                        </ToggleGroupItem>
                        <ToggleGroupItem value="diferencia" className="text-foreground hover:border-warning hover:bg-warning-muted/50 data-[state=on]:border-warning data-[state=on]:bg-warning-muted data-[state=on]:text-warning data-[state=on]:ring-1 data-[state=on]:ring-warning [&_svg]:text-warning">
                          <TriangleAlert className="size-4" aria-hidden />Con diferencia
                        </ToggleGroupItem>
                        <ToggleGroupItem value="equivocado" className="text-foreground hover:border-danger hover:bg-danger-muted/50 data-[state=on]:border-danger data-[state=on]:bg-danger-muted data-[state=on]:text-danger data-[state=on]:ring-1 data-[state=on]:ring-danger [&_svg]:text-danger">
                          <PackageX className="size-4" aria-hidden />Producto equivocado
                        </ToggleGroupItem>
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
                    {state.mark === 'equivocado' && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`comentario-${line.id}`}>¿Qué llegó en su lugar?</Label>
                        <Textarea id={`comentario-${line.id}`} maxLength={NOTE_MAX_LENGTH} className="min-h-10" placeholder="Ej.: llegó ibuprofeno 600 mg en lugar de 400 mg." value={state.comment} onChange={(event) => update(line.id, { comment: event.target.value })} />
                        <p className="text-xs text-foreground-secondary">Se registra como no recibido ({line.delivered} {line.delivered === 1 ? 'unidad' : 'unidades'}). La administración decide si reenvía el producto correcto.</p>
                        {lineError && <p className="text-xs text-danger">{lineError}</p>}
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
          {missingNote && (marked.length > 0 || lines.length === 0)
            ? <span className="font-semibold text-warning">Adjuntá el remito firmado para continuar.</span>
            : marked.length === 0
              ? emptyText
              : <><span className="font-semibold text-foreground">{marked.length} de {lines.length}</span> {lines.length === 1 ? 'producto marcado' : 'productos marcados'}{differences.length > 0 && <>, <span className="font-semibold text-warning">{differences.length} con diferencia</span></>}{wrongProducts.length > 0 && <>, <span className="font-semibold text-danger">{wrongProducts.length} {wrongProducts.length === 1 ? 'equivocado' : 'equivocados'}</span></>}.</>}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href={cancelHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
          <Button data-tour="receipt-submit" type="submit" disabled={pending || !canSubmit}>
            {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />{attachOnly ? 'Adjuntando...' : 'Confirmando...'}</> : attachOnly ? <><Paperclip />Adjuntar remito</> : <><PackageCheck />Confirmar recepción</>}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        icon={attachOnly ? Paperclip : PackageCheck}
        title={attachOnly ? 'Adjuntar remito firmado' : 'Confirmar recepción'}
        description={
          attachOnly ? 'El remito firmado queda adjunto a la entrega y no se puede quitar.' : <>
            {signedNote && <span className="mb-2 block">Se registra en nombre de la administración, con el remito firmado como constancia.</span>}
            {differences.length + wrongProducts.length > 0
              ? signedNote
                ? 'Las diferencias quedan abiertas en la solicitud, para reenviar o cerrar el faltante. Lo confirmado no se puede modificar.'
                : 'Las diferencias informadas serán revisadas por la administración, que resolverá el reenvío o el cierre del faltante. Lo confirmado no se puede modificar.'
              : 'Se registra la recepción conforme de los productos marcados. Lo confirmado no se puede modificar.'}
            {marked.length < lines.length && <span className="mt-2 block font-semibold text-foreground">{lines.length - marked.length === 1 ? 'Queda 1 producto sin confirmar.' : `Quedan ${lines.length - marked.length} productos sin confirmar.`}</span>}
          </>
        }
        confirmLabel={pending ? (attachOnly ? 'Adjuntando...' : 'Confirmando...') : attachOnly ? 'Adjuntar' : 'Confirmar'}
      />
    </form>
  )
}
