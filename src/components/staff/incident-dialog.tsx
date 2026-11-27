'use client'

import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IncidentForm } from '@/components/staff/incident-form'

// Diálogo modal para registrar una novedad. Cerrar sin guardar no pierde nada del listado.
export function IncidentDialog({ staffMemberId, personName }: { staffMemberId: string; personName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const close = () => dialogRef.current?.close()

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => dialogRef.current?.showModal()}>Registrar novedad</Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="incident-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
        className="mx-auto mt-[10vh] mb-auto hidden open:flex max-h-[80vh] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface p-0 text-foreground shadow-card backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 p-6 pb-4">
          <div className="grid gap-1">
            <h2 id="incident-dialog-title" className="text-lg font-semibold">Registrar novedad</h2>
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
          <IncidentForm staffMemberId={staffMemberId} formId={formId} onCancel={close} />
        </div>
      </dialog>
    </>
  )
}
