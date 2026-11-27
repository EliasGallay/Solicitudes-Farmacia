'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// Valor con botón de copiar. Si tiene `href` (tel:, mailto:) el texto es un enlace.
export function CopyValue({ value, href }: { value: string; href?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Sin permiso del portapapeles: el valor sigue visible para copiarlo a mano.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {href ? (
        <a href={href} className="underline-offset-4 hover:underline">{value}</a>
      ) : (
        <span>{value}</span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copiado' : `Copiar ${value}`}
        className="inline-flex size-7 items-center justify-center rounded-md text-foreground-secondary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </span>
  )
}
