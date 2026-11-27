'use client'

import { useId, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StaffForm, type StaffCenter } from '@/components/staff/staff-form'

// Alta de persona en un diálogo modal (<dialog> nativo, como ConfirmDialog y la barra lateral).
// Al guardar, la acción redirige a la ficha; al cancelar o tocar el fondo, el diálogo se cierra sin perder nada.
export function StaffCreateDialog({ centers }: { centers: StaffCenter[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formId = useId()
  const [footer, setFooter] = useState<HTMLElement | null>(null)

  const open = () => dialogRef.current?.showModal()
  const close = () => dialogRef.current?.close()

  return (
    <>
      <Button type="button" onClick={open}>
        <Plus className="size-4" /> Cargar trabajador
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="staff-create-title"
        onClick={(event) => {
          // Tocar el fondo (fuera del contenido) cierra el diálogo.
          if (event.target === event.currentTarget) close()
        }}
        className="m-auto hidden open:flex max-h-[90vh] w-[min(60rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-black/40"
      >
        <div className="flex shrink-0 flex-col gap-5 p-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <h2 id="staff-create-title" className="text-lg font-semibold">Nueva persona</h2>
              <p className="text-sm text-foreground-secondary">Solo nombre y apellido son obligatorios. El resto se puede completar después.</p>
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
        </div>
        {/* El formulario entra en pantallas de 1080 px de alto; solo scrollea el cuerpo si la pantalla es más baja. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-5">
          <StaffForm centers={centers} onCancel={close} formId={formId} footerTarget={footer} />
        </div>
        {/* Pie fijo: Guardar y Cancelar quedan visibles aunque el formulario sea largo. */}
        <footer ref={setFooter} className="shrink-0 border-t border-border px-6 py-4" />
      </dialog>
    </>
  )
}
