'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Selector de fecha propio. El valor viaja como texto ISO (aaaa-mm-dd) y se escribe o se elige como
// dd/mm/aaaa. Escribir: se formatea mientras se tipea y se valida al salir del campo; si no es válida,
// queda el texto con un mensaje para corregirlo. Elegir: calendario con mes y año, lunes primero, seis
// semanas fijas, «Hoy» y «Limpiar».
//
// El calendario se ubica con `position: fixed` según el disparador. Se mide después de montarse (antes de
// pintar) para usar su altura real, y se vuelve a ubicar al hacer scroll o cambiar el tamaño de la ventana.
// Se abre hacia arriba si abajo no hay lugar. Esc y tocar fuera lo cierran.

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const CALENDAR_WIDTH = 288

const pad = (value: number) => String(value).padStart(2, '0')
const toIso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`
const parseIso = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month: month - 1, day }
}
const displayDate = (value: string) => {
  const { year, month, day } = parseIso(value)
  return `${pad(day)}/${pad(month + 1)}/${year}`
}
// Texto dd/mm/aaaa → ISO, o null si no es una fecha real (p. ej. 31/02/2020).
const fromDisplay = (text: string) => {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null
  return toIso(year, month, day)
}
// Mientras se tipea: solo dígitos, con barras en 2 y 4.
const maskDisplay = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
// «Hoy» en Argentina, sin depender de la zona del navegador.
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

// Dropdown propio para mes y año dentro del calendario. Va en línea (no en un portal) para quedar dentro
// del diálogo y por encima del calendario, con el look de los campos del sistema.
// Teclado: Enter, Espacio o flecha abajo abren; flechas mueven; Enter elige; Esc cierra solo la lista.
function MonthYearDropdown<T extends number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((option) => option.value === value)?.label ?? String(value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const openList = () => {
    setActive(Math.max(0, options.findIndex((option) => option.value === value)))
    setOpen(true)
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
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
      // Solo cierra la lista: el calendario sigue abierto.
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openList())}
        className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-2 text-sm text-foreground hover:bg-surface-hover focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:outline-none"
      >
        <span className="tabular-nums">{selectedLabel}</span>
        <ChevronDown className={cn('size-3.5 text-foreground-secondary transition-transform', open && 'rotate-180')} aria-hidden />
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
              ref={(node) => {
                if (index === active && node && open) node.scrollIntoView({ block: 'nearest' })
              }}
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'cursor-pointer px-3 py-1.5 whitespace-nowrap capitalize',
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

export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  startAt,
  disabled = false,
  placeholder = 'dd/mm/aaaa',
  years,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  // Mes que muestra el calendario cuando todavía no hay fecha (p. ej. 1990-01-01 para nacimiento).
  startAt?: string
  disabled?: boolean
  placeholder?: string
  // Rango de años del selector (por defecto, desde 1930 hasta el año próximo).
  years?: [number, number]
  className?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ? displayDate(value) : '')
  const [error, setError] = useState<string | null>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const currentYear = Number(todayIso().slice(0, 4))
  const [fromYear, toYear] = years ?? [1930, currentYear + 1]

  const [view, setView] = useState(() => {
    const reference = parseIso(value || startAt || todayIso())
    return { year: reference.year, month: reference.month }
  })

  // Si el valor cambia desde afuera (p. ej. al limpiar el formulario), el texto y el error se actualizan.
  useEffect(() => {
    setDraft(value ? displayDate(value) : '')
    setError(null)
  }, [value])

  // Al abrir, el calendario muestra el mes del valor, o el de inicio si no hay valor.
  useEffect(() => {
    if (!open) return
    const current = parseIso(value || startAt || todayIso())
    setView({ year: current.year, month: current.month })
  }, [open, value, startAt])

  // Ubica el calendario junto al disparador, con su altura real. Corre antes de pintar, así que no hay
  // un frame con la posición vieja. Se abre hacia arriba si abajo no entra.
  const placePanel = () => {
    const trigger = rootRef.current?.getBoundingClientRect()
    const panel = panelRef.current
    if (!trigger || !panel) return
    const height = panel.offsetHeight
    const flipUp = window.innerHeight - trigger.bottom < height + 8 && trigger.top > height + 8
    const top = flipUp ? trigger.top - height - 8 : trigger.bottom + 8
    const left = Math.max(8, Math.min(trigger.left, window.innerWidth - CALENDAR_WIDTH - 8))
    setPanelStyle({ position: 'fixed', top, left, width: CALENDAR_WIDTH })
  }

  useLayoutEffect(() => {
    if (open) placePanel()
    // placePanel se recrea en cada render; solo importa abrir o cambiar el mes visible.
  }, [open, view])

  // Tocar fuera y Esc cierran; scroll o cambio de tamaño reubican el calendario junto al campo.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const reposition = () => placePanel()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  })

  const isDisabled = (iso: string) => (min !== undefined && iso < min) || (max !== undefined && iso > max)
  const today = todayIso()

  // Seis semanas fijas: siempre la misma altura, con días del mes anterior y siguiente.
  const firstWeekday = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(view.year, view.month, index - firstWeekday + 1))
    return { iso: toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()), inMonth: date.getUTCMonth() === view.month, day: date.getUTCDate() }
  })
  const weeks = Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7))

  const shiftMonth = (delta: number) =>
    setView((current) => {
      const date = new Date(Date.UTC(current.year, current.month + delta, 1))
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
    })

  const choose = (iso: string) => {
    setError(null)
    onChange(iso)
    setOpen(false)
  }

  // Flechas en la grilla: mueven el foco entre días (±1 día, ±7 semana) y saltan de mes al pasar el borde.
  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const step = steps[event.key]
    if (step === undefined) return
    event.preventDefault()
    const focused = document.activeElement?.getAttribute('data-iso')
    if (!focused) return
    const index = cells.findIndex((cell) => cell.iso === focused) + step
    const target = cells[index]
    if (!target) return
    if (!target.inMonth) setView({ year: Number(target.iso.slice(0, 4)), month: Number(target.iso.slice(5, 7)) - 1 })
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${target.iso}"]`)?.focus())
  }

  // Al salir del campo: texto válido y dentro de rango → valor; vacío → sin fecha; inválido o fuera de
  // rango → se conserva el texto y se muestra el motivo, para corregirlo sin perder lo escrito.
  const commitDraft = () => {
    if (draft.trim() === '') {
      setError(null)
      if (value) onChange('')
      return
    }
    const iso = fromDisplay(draft)
    if (!iso) {
      setError('Fecha inválida. Usá dd/mm/aaaa.')
      return
    }
    if (isDisabled(iso)) {
      setError('La fecha está fuera del rango permitido.')
      return
    }
    setError(null)
    if (iso !== value) onChange(iso)
    setDraft(displayDate(iso))
  }

  // Años del selector, incluido el que se está viendo aunque esté fuera del rango.
  const years_ = [...new Set([...Array.from({ length: toYear - fromYear + 1 }, (_, index) => toYear - index), view.year])].sort((a, b) => b - a)

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1', className)}>
      <div className="relative">
        <Input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setError(null)
            setDraft(maskDisplay(event.target.value))
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
            }
          }}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Abrir calendario"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="absolute top-1/2 right-1 -translate-y-1/2"
        >
          <CalendarDays className="size-4" aria-hidden />
        </Button>
      </div>
      {error && <p id={errorId} role="alert" className="text-xs text-danger">{error}</p>}

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Calendario"
          // Oculto hasta ubicarse: el primer render no puede verse en otro lugar.
          style={{ visibility: panelStyle.top === undefined ? 'hidden' : undefined, ...panelStyle }}
          className="z-50 rounded-lg border border-border bg-surface p-3 shadow-card"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-1">
              <MonthYearDropdown
                label="Mes"
                value={view.month}
                options={MONTHS.map((month, index) => ({ value: index, label: month }))}
                onChange={(month) => setView((current) => ({ ...current, month }))}
                className="capitalize"
              />
              <MonthYearDropdown
                label="Año"
                value={view.year}
                options={years_.map((year) => ({ value: year, label: String(year) }))}
                onChange={(year) => setView((current) => ({ ...current, year }))}
              />
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-foreground-secondary" aria-hidden>
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div role="grid" aria-label="Días del mes" onKeyDown={onGridKeyDown} className="mt-1 grid gap-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} role="row" className="grid grid-cols-7 gap-1">
                {week.map((cell) => {
                  const selected = cell.iso === value
                  const blocked = isDisabled(cell.iso)
                  return (
                    <div key={cell.iso} role="gridcell">
                      <button
                        type="button"
                        data-iso={cell.iso}
                        disabled={blocked}
                        aria-pressed={selected}
                        aria-label={displayDate(cell.iso)}
                        onClick={() => choose(cell.iso)}
                        className={cn(
                          'flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                          !cell.inMonth && 'text-foreground-muted',
                          selected ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-surface-hover',
                          cell.iso === today && !selected && 'border border-primary-600 font-semibold',
                          blocked && 'cursor-not-allowed text-foreground-muted opacity-50 hover:bg-transparent',
                        )}
                      >
                        {cell.day}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between border-t border-border pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => choose(today)}>Hoy</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); onChange(''); setOpen(false) }}>Limpiar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
