'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { DEFAULT_METRIC_PERIOD, metricPeriodLabels, metricPeriods, type MetricPeriod } from '@/lib/admin-metrics'

// Período de las métricas, en la URL (?periodo=90). El de por defecto no se escribe.
export function PeriodSelect({ value }: { value: MetricPeriod }) {
  const { setFilters, pending } = useUrlFilters()
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(next) => next && setFilters({ periodo: Number(next) === DEFAULT_METRIC_PERIOD ? undefined : next })}
      aria-label="Período de las métricas"
      aria-busy={pending}
      className="flex-wrap"
    >
      {metricPeriods.map((period) => <ToggleGroupItem key={period} value={String(period)} className="h-8 px-2.5 text-xs sm:text-sm">{metricPeriodLabels[period]}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
