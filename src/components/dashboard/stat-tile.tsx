import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Delta = { value: number | null; unit: '%' | 'pp'; better: 'up' | 'down'; comparedTo: string }

// Indicador del período: valor, variación contra el período anterior y, opcional, la tendencia.
export function StatTile({ icon: Icon, label, value, detail, delta, trend }: { icon: LucideIcon; label: string; value: string; detail?: string; delta?: Delta; trend?: number[] }) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm leading-5 font-medium text-foreground-secondary">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-600"><Icon className="size-4" aria-hidden /></span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl leading-9 font-bold tracking-tight text-foreground">{value}</p>
          {detail && <p className="mt-0.5 truncate text-xs leading-4 text-foreground-muted">{detail}</p>}
        </div>
        {trend && trend.length > 1 && <Sparkline values={trend} />}
      </div>
      {delta && <DeltaBadge {...delta} />}
    </Card>
  )
}

function DeltaBadge({ value, unit, better, comparedTo }: Delta) {
  if (value === null) return <p className="text-xs leading-4 text-foreground-muted">Sin datos para comparar con {comparedTo}</p>
  const good = value === 0 ? null : (value > 0) === (better === 'up')
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-foreground-muted">
      <span className={cn('inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-semibold',
        good === null ? 'bg-surface-muted text-foreground-secondary' : good ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger')}>
        <Icon className="size-3.5" aria-hidden />
        {sign}{Math.abs(value)}{unit === '%' ? ' %' : ' pp'}
      </span>
      vs. {comparedTo}
    </p>
  )
}

// Tendencia sin ejes: el último punto se marca con un punto.
function Sparkline({ values }: { values: number[] }) {
  const width = 96
  const height = 36
  const max = Math.max(...values, 1)
  const points = values.map((value, index) => [2 + (index / (values.length - 1)) * (width - 6), height - 4 - (value / max) * (height - 8)] as const)
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = points[points.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden>
      <path d={`${line} L${lastX.toFixed(1)},${height} L2,${height} Z`} className="fill-chart-1/10" />
      <path d={line} className="fill-none stroke-chart-1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={3.5} className="fill-chart-1 stroke-surface" strokeWidth={2} />
    </svg>
  )
}
