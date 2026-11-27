'use client'

import { useId, useRef, useState, useTransition, type FormEvent } from 'react'
import { addStaffIncidentEvent } from '@/app/staff-actions'
import { DateField } from '@/components/date-field'
import { FormError } from '@/components/form-feedback'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { todayInArgentina } from '@/lib/staff'

// Agrega un evento de seguimiento a una novedad (un pedido, una recepción, cualquier hecho posterior).
// La fecha va entre la del hecho y hoy. No se edita ni se borra: se agrega.
export function IncidentEventDialog({ incidentId, staffMemberId, occurredOn, label }: { incidentId: string; staffMemberId: string; occurredOn: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const [eventOn, setEventOn] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const today = todayInArgentina()

  const close = () => dialogRef.current?.close()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addStaffIncidentEvent({
        incident_id: incidentId,
        staff_member_id: staffMemberId,
        occurred_on: occurredOn,
        event_on: eventOn,
        note,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      setEventOn('')
      setNote('')
      close()
    })
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => dialogRef.current?.showModal()}>Agregar seguimiento</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`event-${incidentId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="m-auto hidden open:flex w-[min(30rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
      >
        <form id={formId} onSubmit={submit} className="grid gap-4 p-6" noValidate>
          <div className="grid gap-1">
            <h2 id={`event-${incidentId}`} className="text-lg font-semibold">Agregar seguimiento</h2>
            <p className="text-sm text-foreground-secondary">{label}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`event-date-${incidentId}`}>Fecha <span aria-hidden className="text-danger">*</span></Label>
            <DateField id={`event-date-${incidentId}`} value={eventOn} onChange={setEventOn} min={occurredOn} max={today} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`event-note-${incidentId}`}>Seguimiento <span aria-hidden className="text-danger">*</span></Label>
            <Textarea id={`event-note-${incidentId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
          </div>
          {error ? <FormError>{error}</FormError> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
            <Button type="submit" disabled={pending || eventOn === '' || note.trim() === ''}>{pending ? 'Guardando…' : 'Agregar'}</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
