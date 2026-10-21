import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatCount } from '@/lib/chart'
import { cn } from '@/lib/utils'

// Gráficos de desglose del panel del admin. Son componentes de servidor: el tooltip se muestra con
// CSS al pasar el puntero o al enfocar la fila, y todos los valores también quedan visibles o en una
// tabla para lectores de pantalla (el tooltip nunca es la única forma de leer un dato).

const tooltipClass = 'pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 min-w-40 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 opacity-0 shadow-elevated transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100'

function Tooltip({ title, rows }: { title: string; rows: { label: string; value: string; swatch?: string }[] }) {
  return (
    <span role="tooltip" className={tooltipClass}>
      <span className="mb-1.5 block text-xs leading-4 font-medium text-foreground-secondary">{title}</span>
      {rows.map((row) => (
        <span key={row.label} className="flex items-center gap-2 text-xs leading-5">
          {row.swatch && <span aria-hidden className={cn('size-2 shrink-0 rounded-[2px]', row.swatch)} />}
          <span className="font-bold text-foreground tabular-nums">{row.value}</span>
          <span className="text-foreground-secondary">{row.label}</span>
        </span>
      ))}
    </span>
  )
}

export function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs leading-4 text-foreground-secondary">
          <span aria-hidden className={cn('size-2.5 rounded-[3px]', item.swatch)} />{item.label}
        </li>
      ))}
    </ul>
  )
}

// Barra apilada horizontal: segmentos separados por 2px de superficie, extremos redondeados.
export type StackSegment = { key: string; label: string; value: number; swatch: string }

export function StackedBars({ rows }: { rows: { key: string; label: string; segments: StackSegment[]; note: ReactNode }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.segments.reduce((sum, segment) => sum + segment.value, 0)))
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const total = row.segments.reduce((sum, segment) => sum + segment.value, 0)
        const visible = row.segments.filter((segment) => segment.value > 0)
        return (
          <li key={row.key} tabIndex={0} className="group relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4 focus-visible:ring-offset-surface">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm leading-5">
              <span className="truncate font-semibold text-foreground">{row.label}</span>
              <span className="shrink-0 text-xs text-foreground-secondary">{row.note}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-surface-muted">
              <div className="flex h-full gap-0.5 motion-safe:animate-step-fill origin-left" style={{ width: `${(total / max) * 100}%` }}>
                {visible.map((segment) => (
                  <span key={segment.key} className={cn('h-full min-w-1 first:rounded-l-full last:rounded-r-full transition-opacity group-hover:opacity-90', segment.swatch)} style={{ flexGrow: segment.value }} />
                ))}
              </div>
            </div>
            <Tooltip title={`${row.label} · ${formatCount(total)} unidades`} rows={row.segments.map((segment) => ({ label: segment.label, value: formatCount(segment.value), swatch: segment.swatch }))} />
          </li>
        )
      })}
    </ul>
  )
}

// Ranking: una sola serie, un solo color; el valor va al final de la barra.
export function BarList({ rows, unit }: { rows: { key: string; label: string; sublabel?: string; value: number; detail?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li key={row.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="text-xs font-semibold text-foreground-muted tabular-nums">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm leading-5 font-medium text-foreground">
              {row.label}{row.sublabel && <span className="font-normal text-foreground-muted"> · {row.sublabel}</span>}
            </p>
            <div className="mt-1 h-2 w-full">
              <div className="h-full rounded-r-[4px] rounded-l-[2px] bg-chart-1 motion-safe:animate-step-fill origin-left" style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }} />
            </div>
          </div>
          <p className="text-right">
            <span className="block text-sm leading-5 font-bold text-foreground tabular-nums">{formatCount(row.value)}<span className="sr-only"> {unit}</span></span>
            {row.detail && <span className="block text-xs leading-4 text-foreground-muted">{row.detail}</span>}
          </p>
        </li>
      ))}
    </ol>
  )
}

// Parte del todo con pocas categorías (hasta 4 + "Otros"): anillo con el total al centro.
export function Donut({ segments, centerLabel }: { segments: { key: string; label: string; value: number; stroke: string; swatch: string }[]; centerLabel: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const size = 168
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const gap = segments.filter((segment) => segment.value > 0).length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={radius} className="fill-none stroke-surface-muted" strokeWidth={stroke} />
          {total > 0 && segments.filter((segment) => segment.value > 0).map((segment) => {
            const length = (segment.value / total) * circumference
            const dash = Math.max(length - gap, 0.5)
            const element = <circle key={segment.key} cx={size / 2} cy={size / 2} r={radius} className={cn('fill-none', segment.stroke)} strokeWidth={stroke} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} />
            offset += length
            return element
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl leading-9 font-bold text-foreground">{formatCount(total)}</span>
          <span className="text-xs leading-4 text-foreground-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2.5 text-sm leading-5">
            <span aria-hidden className={cn('size-2.5 shrink-0 rounded-[3px]', segment.swatch)} />
            <span className="min-w-0 flex-1 truncate text-foreground-secondary">{segment.label}</span>
            <span className="font-bold text-foreground tabular-nums">{formatCount(segment.value)}</span>
            <span className="w-10 text-right text-xs text-foreground-muted tabular-nums">{total > 0 ? Math.round((segment.value / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Columnas con el valor sobre el tope; cada columna lleva al listado filtrado.
export function Columns({ columns }: { columns: { key: string; label: string; value: number; swatch: string; href: string; hint: string }[] }) {
  const max = Math.max(1, ...columns.map((column) => column.value))
  return (
    <div className="flex h-52 items-end gap-3 border-b border-border-strong px-1 pt-8">
      {columns.map((column) => (
        <Link key={column.key} href={column.href} className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <span
            className={cn('relative w-full max-w-12 rounded-t-[4px] transition-opacity group-hover:opacity-80 motion-safe:animate-enter-from-below', column.swatch)}
            style={{ height: column.value > 0 ? `max(${(column.value / max) * 100}%, 4px)` : '2px' }}
          >
            <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 text-lg leading-6 font-bold text-foreground tabular-nums">{column.value}</span>
          </span>
          <span className="sr-only">{column.hint}</span>
        </Link>
      ))}
    </div>
  )
}

export function ColumnLabels({ labels }: { labels: string[] }) {
  return (
    <div className="mt-2 flex gap-3 px-1">
      {labels.map((label) => <span key={label} className="min-w-0 flex-1 text-center text-xs leading-4 text-foreground-secondary">{label}</span>)}
    </div>
  )
}
