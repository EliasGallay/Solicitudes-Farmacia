'use client'

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { registerStaffIncident } from '@/app/staff-actions'
import { DateField } from '@/components/date-field'
import { FormError } from '@/components/form-feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { INCIDENT_CATEGORY_MAX, INCIDENT_CATEGORY_SUGGESTIONS, todayInArgentina } from '@/lib/staff'

// Carga de una novedad. La categoría es texto libre con sugerencias: el admin puede escribir lo que haga falta.
// Las fechas no pueden ser futuras. El fin es opcional, para hechos que abarcan varios días.

type IncidentState = {
  category: string
  occurred_on: string
  ends_on: string
  description: string
}

const initial: IncidentState = { category: '', occurred_on: '', ends_on: '', description: '' }

export function IncidentForm({ staffMemberId, formId, onCancel, onDone }: { staffMemberId: string; formId: string; onCancel: () => void; onDone?: () => void }) {
  const [state, setState] = useState<IncidentState>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const today = todayInArgentina()
  const listId = `${formId}-categories`

  const update = (field: 'category' | 'description') => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((current) => ({ ...current, [field]: event.target.value }))

  const setDate = (field: 'occurred_on' | 'ends_on') => (value: string) => setState((current) => ({ ...current, [field]: value }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const values = {
      staff_member_id: staffMemberId,
      category: state.category,
      occurred_on: state.occurred_on,
      ends_on: state.ends_on || null,
      description: state.description || null,
    }
    startTransition(async () => {
      const result = await registerStaffIncident(values)
      if (result?.error) setError(result.error)
      else onDone?.()
    })
  }

  return (
    <form id={formId} onSubmit={submit} className="grid gap-6" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="incident_category">Categoría <span aria-hidden className="text-danger">*</span></Label>
        <Input
          id="incident_category"
          value={state.category}
          onChange={update('category')}
          maxLength={INCIDENT_CATEGORY_MAX}
          list={listId}
          placeholder="Ej.: Ausencia injustificada"
          autoComplete="off"
        />
        <datalist id={listId}>
          {INCIDENT_CATEGORY_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="occurred_on">Fecha del hecho <span aria-hidden className="text-danger">*</span></Label>
          <DateField id="occurred_on" value={state.occurred_on} onChange={setDate('occurred_on')} max={today} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ends_on">Hasta (opcional)</Label>
          <DateField id="ends_on" value={state.ends_on} onChange={setDate('ends_on')} max={today} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="incident_description">Descripción</Label>
        <Textarea id="incident_description" value={state.description} onChange={update('description')} maxLength={500} rows={3} />
      </div>

      {error ? <FormError>{error}</FormError> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={pending || state.category.trim() === '' || state.occurred_on === ''}>
          {pending ? 'Guardando…' : 'Registrar novedad'}
        </Button>
      </div>
    </form>
  )
}
