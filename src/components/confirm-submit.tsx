'use client'

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { LoaderCircle } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { ConfirmDialog, type ConfirmTone } from '@/components/ui/confirm-dialog'

type ConfirmSubmitProps = ButtonProps & {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  // Por defecto, destructivo si el botón lo es.
  tone?: ConfirmTone
}

// Botón de envío de un <form action={...}> que pide confirmación con ConfirmDialog antes de enviar.
// Al confirmar envía el form con este botón como submitter (se conservan name/value del botón).
export function ConfirmSubmit({ title, description, confirmLabel, tone, children, variant = 'ghost', disabled, ...props }: ConfirmSubmitProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const { pending } = useFormStatus()

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    // Validación nativa del form (campos required) antes de preguntar.
    if (buttonRef.current?.form?.reportValidity() === false) return
    setOpen(true)
  }

  // requestSubmit dispara el submit del form sin volver a pasar por el click del botón.
  function confirm() {
    setOpen(false)
    const button = buttonRef.current
    button?.form?.requestSubmit(button)
  }

  return (
    <>
      <Button ref={buttonRef} type="submit" variant={variant} disabled={disabled || pending} onClick={handleClick} {...props}>
        {pending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
        title={title}
        description={description}
        confirmLabel={confirmLabel ?? children}
        tone={tone ?? (variant === 'destructive' ? 'destructive' : 'default')}
      />
    </>
  )
}
