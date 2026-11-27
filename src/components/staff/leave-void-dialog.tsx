'use client'

import { useRef } from 'react'
import { voidStaffLeave } from '@/app/staff-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Anulación con confirmación: el botón «Anular» abre un diálogo que pide el motivo. La licencia queda en
// el historial como anulada; no se borra.
export function LeaveVoidDialog({ leaveId, staffMemberId, label }: { leaveId: string; staffMemberId: string; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => dialogRef.current?.showModal()}>Anular</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`void-${leaveId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
        className="m-auto hidden open:flex w-[min(30rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
      >
        <form action={voidStaffLeave} className="grid gap-4 p-6">
          <input type="hidden" name="leave_id" value={leaveId} />
          <input type="hidden" name="staff_member_id" value={staffMemberId} />
          <div className="grid gap-1">
            <h2 id={`void-${leaveId}`} className="text-lg font-semibold">¿Anular esta licencia?</h2>
            <p className="text-sm text-foreground-secondary">{label}. Queda en el historial marcada como anulada y se registra en Auditoría.</p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Motivo de la anulación <span aria-hidden className="text-danger">*</span>
            <Textarea name="reason" required maxLength={500} rows={3} className="font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>Cancelar</Button>
            <Button type="submit" variant="destructive">Anular licencia</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
