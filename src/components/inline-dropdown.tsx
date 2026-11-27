'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Dropdown propio, en línea (no en un portal). Radix Select se monta en el body y queda detrás de un
// <dialog> modal, así que dentro de diálogos usamos este. Mismo look que los campos del sistema.
// Teclado: Enter, Espacio o flecha abajo abren; flechas mueven; Enter elige; Esc cierra la lista.
export function InlineDropdown<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegí…',
  disabled = false,
  size = 'md',
  className,
}: {
  id?: string
  label: string
  value: T | ''
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const openList = () => {
    if (disabled) return
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(options.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onChange(options[active].value)
      setOpen(false)
    } else if (event.key === 'Escape') {
      // Solo cierra la lista: si está dentro de un diálogo, el diálogo no se cierra.
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', size === 'md' && 'w-full', className)} onKeyDown={onKeyDown}>
      <button
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border border-border bg-surface text-foreground transition-colors focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-muted',
          size === 'md' ? 'h-10 w-full px-3 text-base sm:text-sm' : 'h-8 px-2 text-sm hover:bg-surface-hover',
        )}
      >
        <span className={cn('truncate', !selected && 'text-foreground-muted')}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-foreground-secondary transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 max-h-56 min-w-full overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm shadow-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'cursor-pointer px-3 py-2 whitespace-nowrap',
                index === active && 'bg-surface-hover',
                option.value === value && 'font-semibold text-primary-700',
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
