'use client'

import { useRef } from 'react'
import { voidStaffIncidentEvent } from '@/app/staff-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Anulación de un seguimiento con confirmación: pide el motivo. El seguimiento queda en el historial, tachado.
export function IncidentEventVoidDialog({ eventId, staffMemberId, label }: { eventId: string; staffMemberId: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="border border-border-strong bg-surface hover:bg-surface-hover" aria-label="Anular seguimiento" title="Anular este seguimiento" onClick={() => dialogRef.current?.showModal()}>Anular</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`void-event-${eventId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
        className="m-auto hidden open:flex w-[min(30rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
      >
        <form action={voidStaffIncidentEvent} className="grid gap-4 p-6">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="staff_member_id" value={staffMemberId} />
          <div className="grid gap-1">
            <h2 id={`void-event-${eventId}`} className="text-lg font-semibold">¿Anular este seguimiento?</h2>
            <p className="text-sm text-foreground-secondary">{label}</p>
            <p className="text-sm text-foreground-secondary">Solo se anula este seguimiento. La novedad y los demás seguimientos no se modifican. Queda en el historial marcado como anulado y se registra en Auditoría.</p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo de la anulación <span aria-hidden className="text-danger">*</span>
            <Textarea name="reason" required maxLength={500} rows={3} className="font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>Cancelar</Button>
            <Button type="submit" variant="destructive">Anular seguimiento</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
