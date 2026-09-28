'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CircleAlert, CircleHelp, LoaderCircle, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const tones = {
  default: { icon: CircleHelp, badge: 'bg-primary-100 text-primary-600', button: 'default' as const },
  destructive: { icon: CircleAlert, badge: 'bg-danger-muted text-danger', button: 'destructive' as const },
}

export type ConfirmTone = keyof typeof tones

// Cada botón ocupa media fila: si el texto no entra, pasa a dos líneas en vez de desbordar.
const footerButton = 'h-auto min-h-10 w-full whitespace-normal text-center'

export type ConfirmDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  // Contenido extra entre el texto y los botones (p. ej. el resumen de lo que se va a confirmar).
  children?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: string
  tone?: ConfirmTone
  icon?: LucideIcon
  // Mientras la acción corre: botones deshabilitados y no se puede cerrar.
  pending?: boolean
}

// Confirmación modal con <dialog>: atrapa el foco, cierra con Esc o tocando el fondo y deja inerte
// el resto de la página. En las destructivas el foco inicial va a "Cancelar".
export function ConfirmDialog({ open, onCancel, onConfirm, title, description, children, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default', icon, pending = false }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const style = tones[tone]
  const Icon = icon ?? style.icon

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', open)
    return () => document.documentElement.classList.remove('overflow-hidden')
  }, [open])

  function cancel() {
    if (!pending) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Esc: se maneja acá para respetar `pending` y mantener el estado controlado por `open`.
      onCancel={(event) => { event.preventDefault(); cancel() }}
      onClick={(event) => { if (event.target === event.currentTarget) cancel() }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-foreground/50 open:motion-safe:animate-enter-from-below"
    >
      <div className="relative flex gap-4 p-5 sm:p-6">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12', style.badge)}><Icon className="size-5 sm:size-6" aria-hidden /></span>
        <div className="min-w-0 flex-1 pr-6">
          <h2 id={titleId} className="text-lg leading-7 font-bold text-foreground">{title}</h2>
          {description && <div id={descriptionId} className="mt-1 text-sm leading-5 text-foreground-secondary">{description}</div>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        <button type="button" aria-label="Cerrar" disabled={pending} onClick={cancel} className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-md text-foreground-secondary hover:bg-primary-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {/* Botones lado a lado, cada uno la mitad del ancho del modal. */}
      <div className="grid grid-cols-2 gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:px-6">
        <Button type="button" variant="secondary" className={footerButton} disabled={pending} onClick={cancel} autoFocus={tone === 'destructive'}>{cancelLabel}</Button>
        <Button type="button" variant={style.button} className={footerButton} disabled={pending} onClick={onConfirm} autoFocus={tone !== 'destructive'}>
          {pending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
