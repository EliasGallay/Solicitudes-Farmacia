'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { axisLabelIndexes, formatCount, niceScale } from '@/lib/chart'
import { cn } from '@/lib/utils'

export type TrendSeries = { key: string; label: string; color: 'chart-1' | 'chart-2'; values: number[] }

const HEIGHT = 240
const PAD = { top: 12, right: 12, bottom: 28, left: 36 }

const strokes = { 'chart-1': 'stroke-chart-1', 'chart-2': 'stroke-chart-2' }
const fills = { 'chart-1': 'fill-chart-1', 'chart-2': 'fill-chart-2' }
const gradientStops = { 'chart-1': 'var(--color-chart-1)', 'chart-2': 'var(--color-chart-2)' }
const keys = { 'chart-1': 'bg-chart-1', 'chart-2': 'bg-chart-2' }

// Líneas en un solo eje con crosshair: el puntero (o las flechas del teclado) elige el bucket más
// cercano y el tooltip muestra todas las series en ese punto.
export function TrendChart({ labels, axisLabels, series }: { labels: string[]; axisLabels: string[]; series: TrendSeries[] }) {
  // useId puede traer ':' o '«»', que rompen url(#...).
  const id = `trend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const count = labels.length
  const scale = niceScale(Math.max(1, ...series.flatMap((serie) => serie.values)))
  const plotWidth = Math.max(width - PAD.left - PAD.right, 1)
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (count > 1 ? (index / (count - 1)) * plotWidth : plotWidth / 2)
  const y = (value: number) => PAD.top + plotHeight - (value / scale.max) * plotHeight
  const xLabels = axisLabelIndexes(count, width < 480 ? 4 : 7)

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left - PAD.left) / plotWidth
    setActive(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))))
  }

  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    setActive((current) => Math.min(count - 1, Math.max(0, (current ?? (delta > 0 ? -1 : count)) + delta)))
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Series">
        {series.map((serie) => (
          <li key={serie.key} className="flex items-center gap-2 text-sm leading-5 text-foreground-secondary">
            <span aria-hidden className={cn('h-0.5 w-4 rounded-full', keys[serie.color])} />
            {serie.label}
            <span className="font-semibold text-foreground">{formatCount(serie.values.reduce((sum, value) => sum + value, 0))}</span>
          </li>
        ))}
      </ul>

      <div ref={frame} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Evolución de ${series.map((serie) => serie.label.toLowerCase()).join(' y ')}. Usá las flechas para recorrer los puntos.`}
            tabIndex={0}
            className="touch-pan-y rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            onKeyDown={step}
            onBlur={() => setActive(null)}
          >
            <defs>
              {series.map((serie) => (
                <linearGradient key={serie.key} id={`${id}-${serie.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={gradientStops[serie.color]} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={gradientStops[serie.color]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {scale.ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? 'stroke-border-strong' : 'stroke-chart-grid'} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-foreground-muted text-[11px] tabular-nums">{formatCount(tick)}</text>
              </g>
            ))}
            {xLabels.map((index) => (
              <text key={index} x={x(index)} y={HEIGHT - 8} textAnchor={index === 0 && count > 1 ? 'start' : index === count - 1 && count > 1 ? 'end' : 'middle'} className="fill-foreground-muted text-[11px]">{axisLabels[index]}</text>
            ))}

            {series.map((serie) => {
              const line = serie.values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
              return (
                <g key={serie.key}>
                  <path d={`${line} L${x(count - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`} fill={`url(#${id}-${serie.key})`} />
                  <path d={line} className={cn('fill-none', strokes[serie.color])} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  {active === null && count > 0 && <circle cx={x(count - 1)} cy={y(serie.values[count - 1])} r={4} className={cn('stroke-surface', fills[serie.color])} strokeWidth={2} />}
                </g>
              )
            })}

            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} className="stroke-foreground-muted" strokeWidth={1} shapeRendering="crispEdges" />
                {series.map((serie) => <circle key={serie.key} cx={x(active)} cy={y(serie.values[active])} r={5} className={cn('stroke-surface', fills[serie.color])} strokeWidth={2} />)}
              </g>
            )}
          </svg>
        )}

        {active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-md border border-border bg-surface px-3 py-2 shadow-elevated"
            style={x(active) > width / 2 ? { right: width - x(active) + 12 } : { left: x(active) + 12 }}
          >
            <p className="mb-1.5 text-xs leading-4 font-medium text-foreground-secondary">{labels[active]}</p>
            <ul className="flex flex-col gap-1">
              {series.map((serie) => (
                <li key={serie.key} className="flex items-center gap-2 text-xs leading-4">
                  <span aria-hidden className={cn('h-0.5 w-3 rounded-full', keys[serie.color])} />
                  <span className="text-base leading-5 font-bold text-foreground tabular-nums">{serie.values[active]}</span>
                  <span className="text-foreground-secondary">{serie.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Datos del gráfico</caption>
        <thead><tr><th scope="col">Período</th>{series.map((serie) => <th key={serie.key} scope="col">{serie.label}</th>)}</tr></thead>
        <tbody>{labels.map((label, index) => <tr key={label}><th scope="row">{label}</th>{series.map((serie) => <td key={serie.key}>{serie.values[index]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
