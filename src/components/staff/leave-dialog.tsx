'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LeaveForm, type LeaveToEdit } from '@/components/staff/leave-form'

// Diálogo modal para registrar una licencia, o para corregir una existente si llega `leave`. Se abre desde un
// botón (`triggerLabel`) o al montar si `openOnMount` (enlace «Registrar licencia» del listado). Cerrar sin
// guardar no pierde nada del listado.
export function LeaveDialog({
  staffMemberId,
  personName,
  triggerLabel,
  openOnMount = false,
  leave,
}: {
  staffMemberId: string
  personName: string
  triggerLabel: string
  openOnMount?: boolean
  leave?: LeaveToEdit
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const title = leave ? 'Corregir licencia' : 'Registrar licencia'

  // Al abrir, el foco va al tipo de licencia (no a la X de cerrar, que es lo primero del diálogo).
  const showDialog = () => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    dialog.querySelector<HTMLElement>('#kind')?.focus()
  }

  useEffect(() => {
    if (openOnMount) showDialog()
    // Solo al montar: el enlace del listado abre el diálogo una vez.
  }, [openOnMount])

  const open = showDialog
  const close = () => dialogRef.current?.close()

  return (
    <>
      <Button type="button" variant={leave ? 'ghost' : 'default'} size={leave ? 'sm' : 'default'} onClick={open}>{triggerLabel}</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={leave ? `leave-dialog-title-${leave.id}` : 'leave-dialog-title'}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="mx-auto mt-[10vh] mb-auto hidden open:flex max-h-[80vh] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface p-0 text-left text-foreground shadow-card backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 p-6 pb-4">
          <div className="grid gap-1">
            <h2 id={leave ? `leave-dialog-title-${leave.id}` : 'leave-dialog-title'} className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-foreground-secondary">{personName}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <LeaveForm staffMemberId={staffMemberId} formId={formId} footerTarget={footer} onCancel={close} leave={leave} />
        </div>
        {/* Pie fijo con los botones: visibles aunque el contenido crezca. */}
        <footer ref={setFooter} className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4" />
      </dialog>
    </>
  )
}
