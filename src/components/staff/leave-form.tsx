'use client'

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { registerStaffLeave } from '@/app/staff-actions'
import { DateField } from '@/components/date-field'
import { FormError } from '@/components/form-feedback'
import { InlineDropdown } from '@/components/inline-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { leaveKindLabels, LEAVE_KINDS, PERMIT_HOURS, type LeaveKind } from '@/lib/staff'

// Carga de una licencia. Primero se elige el tipo con tres opciones visibles. Después aparecen solo los
// campos de ese tipo, sin campos deshabilitados:
// - Vacaciones: Desde, Hasta y Días descontados.
// - Permiso por horas: Fecha y Horas.
// - Otra licencia: Desde, Hasta, Días descontados y Motivo (obligatorio).

const kindDescriptions: Record<LeaveKind, string> = {
  vacation: 'Días seguidos, con desde y hasta',
  hours_permit: 'Una fecha, 1,5 o 3 horas',
  other: 'Compensatorio, estudios, duelo, otro',
}

type LeaveState = {
  kind: LeaveKind | ''
  starts_on: string
  ends_on: string
  days: string
  hours: string
  note: string
  comment: string
}

const initial: LeaveState = { kind: '', starts_on: '', ends_on: '', days: '', hours: '', note: '', comment: '' }

export function LeaveForm({
  staffMemberId,
  formId,
  footerTarget,
  onCancel,
}: {
  staffMemberId: string
  formId?: string
  footerTarget?: HTMLElement | null
  onCancel?: () => void
}) {
  const [state, setState] = useState<LeaveState>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (field: keyof LeaveState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((current) => ({ ...current, [field]: event.target.value }))

  const setDate = (field: 'starts_on' | 'ends_on') => (value: string) => setState((current) => ({ ...current, [field]: value }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state.kind) {
      setError('Elegí el tipo de licencia.')
      return
    }
    setError(null)
    const isPermit = state.kind === 'hours_permit'
    const values = {
      staff_member_id: staffMemberId,
      kind: state.kind,
      starts_on: state.starts_on,
      ends_on: isPermit ? null : state.ends_on || null,
      days: isPermit || state.days === '' ? null : Number(state.days),
      hours: isPermit ? Number(state.hours) : null,
      note: state.kind === 'other' ? state.note : null,
      comment: state.comment || null,
    }
    startTransition(async () => {
      const result = await registerStaffLeave(values)
      if (result?.error) setError(result.error)
    })
  }

  const kind = state.kind
  const isPermit = kind === 'hours_permit'
  const hasRange = kind === 'vacation' || kind === 'other'
  const isOther = kind === 'other'

  const actions = (
    <>
      <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" form={formId} disabled={pending || kind === ''}>{pending ? 'Guardando…' : 'Registrar licencia'}</Button>
    </>
  )

  return (
    <form id={formId} onSubmit={submit} className="grid gap-6" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo de licencia <span aria-hidden className="text-danger">*</span></legend>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de licencia">
          {LEAVE_KINDS.map((option) => {
            const selected = kind === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setState((current) => ({ ...current, kind: option }))}
                className={cn(
                  'grid gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  selected ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-border bg-surface text-foreground hover:bg-surface-hover',
                )}
              >
                <span className="text-base font-semibold">{leaveKindLabels[option]}</span>
                <span className={cn('text-xs', selected ? 'text-primary-700' : 'text-foreground-secondary')}>{kindDescriptions[option]}</span>
              </button>
            )
          })}
        </div>
        {error && !kind ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      </fieldset>

      {isPermit ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="permit_date">Fecha <span aria-hidden className="text-danger">*</span></Label>
            <DateField id="permit_date" value={state.starts_on} onChange={setDate('starts_on')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hours">Horas <span aria-hidden className="text-danger">*</span></Label>
            <InlineDropdown
              id="hours"
              label="Horas del permiso"
              value={state.hours === '' ? '' : Number(state.hours)}
              placeholder="Elegí las horas"
              options={PERMIT_HOURS.map((hours) => ({ value: hours, label: `${String(hours).replace('.', ',')} hs` }))}
              onChange={(hours) => setState((current) => ({ ...current, hours: String(hours) }))}
            />
          </div>
        </div>
      ) : null}

      {hasRange ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="starts_on">Desde <span aria-hidden className="text-danger">*</span></Label>
            <DateField id="starts_on" value={state.starts_on} onChange={setDate('starts_on')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ends_on">Hasta <span aria-hidden className="text-danger">*</span></Label>
            <DateField id="ends_on" value={state.ends_on} min={state.starts_on || undefined} onChange={setDate('ends_on')} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="days">Días descontados <span aria-hidden className="text-danger">*</span></Label>
            <Input id="days" type="number" min={1} max={366} inputMode="numeric" value={state.days} onChange={update('days')} className="sm:max-w-40" />
            <p className="text-xs text-foreground-secondary">Pueden ser menos días que el rango si hay fines de semana o feriados.</p>
          </div>
        </div>
      ) : null}

      {isOther ? (
        <div className="grid gap-1.5">
          <Label htmlFor="note">Motivo <span aria-hidden className="text-danger">*</span></Label>
          <Input id="note" value={state.note} onChange={update('note')} maxLength={500} placeholder="Ej.: compensatorio, estudios, duelo" />
        </div>
      ) : null}

      {kind ? (
        <div className="grid gap-1.5">
          <Label htmlFor="comment">Comentario interno <span className="text-foreground-secondary">(opcional)</span></Label>
          <Textarea id="comment" value={state.comment} onChange={update('comment')} maxLength={500} rows={2} />
        </div>
      ) : null}

      {error && kind ? <FormError>{error}</FormError> : null}

      {/* Acciones: en el pie del diálogo si hay `footerTarget`. El botón envía el formulario con `form`. */}
      {footerTarget ? createPortal(actions, footerTarget) : actions}
    </form>
  )
}
