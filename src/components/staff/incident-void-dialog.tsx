'use client'

import { useRef } from 'react'
import { voidStaffIncident } from '@/app/staff-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Anulación con confirmación, igual que la de licencias: pide el motivo y la novedad queda en el historial.
export function IncidentVoidDialog({ incidentId, staffMemberId, label }: { incidentId: string; staffMemberId: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => dialogRef.current?.showModal()}>Anular novedad</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`void-incident-${incidentId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
        className="m-auto hidden open:flex w-[min(30rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
      >
        <form action={voidStaffIncident} className="grid gap-4 p-6">
          <input type="hidden" name="incident_id" value={incidentId} />
          <input type="hidden" name="staff_member_id" value={staffMemberId} />
          <div className="grid gap-1">
            <h2 id={`void-incident-${incidentId}`} className="text-lg font-semibold">¿Anular esta novedad?</h2>
            <p className="text-sm text-foreground-secondary">{label}. Queda en el historial marcada como anulada y se registra en Auditoría.</p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo de la anulación <span aria-hidden className="text-danger">*</span>
            <Textarea name="reason" required maxLength={500} rows={3} className="font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>Cancelar</Button>
            <Button type="submit" variant="destructive">Anular novedad</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
