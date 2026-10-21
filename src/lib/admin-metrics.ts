import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClosureReason } from './request-management'

// Métricas del panel del admin: las calcula la RPC admin_dashboard_metrics
// (supabase/migrations/202610200001_admin_metrics.sql) para el período elegido y el anterior.

export const metricPeriods = [7, 30, 90, 365] as const
export type MetricPeriod = (typeof metricPeriods)[number]
export const DEFAULT_METRIC_PERIOD: MetricPeriod = 30

export const metricPeriodLabels: Record<MetricPeriod, string> = {
  7: '7 días',
  30: '30 días',
  90: '3 meses',
  365: '12 meses',
}

export const metricPeriodParamSchema = z.coerce.number().int()
  .refine((value): value is MetricPeriod => (metricPeriods as readonly number[]).includes(value))
  .catch(DEFAULT_METRIC_PERIOD)

export type MetricsSeriesPoint = { day: string; requests: number; deliveries: number }
export type CenterMetrics = { id: string; name: string; requests: number; delivered: number; pending: number; closed: number }
export type AreaMetrics = { key: string; name: string; requests: number }
export type ProductMetrics = { name: string; presentation: string; area: string; requested: number; pending: number; requests: number }

export type AdminMetrics = {
  from: string
  to: string
  bucket: 'day' | 'week'
  kpis: {
    requests: number
    requests_prev: number
    deliveries: number
    deliveries_prev: number
    units_requested: number
    units_delivered: number
    units_requested_prev: number
    units_delivered_prev: number
    first_delivery_hours: number | null
    first_delivery_hours_prev: number | null
  }
  series: MetricsSeriesPoint[]
  centers: CenterMetrics[]
  areas: AreaMetrics[]
  top_products: ProductMetrics[]
  aging: { d0_2: number; d3_6: number; d7_13: number; d14: number }
  closures: { reason: ClosureReason; units: number }[]
  receipts: { lines: number; with_difference: number; wrong_product: number; voided_deliveries: number }
}

// null ante un error (la pantalla muestra el estado de error de la sección).
export async function getAdminMetrics(supabase: SupabaseClient, period: MetricPeriod): Promise<AdminMetrics | null> {
  const { data, error } = await supabase.rpc('admin_dashboard_metrics', { period_days: period })
  if (error) console.error('Error al cargar métricas', error)
  return error ? null : data as AdminMetrics
}

// Porcentaje entero de `part` sobre `total`; null si no hay total.
export function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null
}

// Variación porcentual contra el período anterior; null si no hay base para comparar.
export function relativeChange(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null
}

// Duración legible de una mediana en horas: "5 h" por debajo de un día, "2,5 días" después.
export function formatHours(hours: number | null) {
  if (hours === null) return '—'
  if (hours < 1) return '< 1 h'
  if (hours < 24) return `${Math.round(hours)} h`
  const days = Math.round((hours / 24) * 10) / 10
  return `${days.toLocaleString('es-AR')} ${days === 1 ? 'día' : 'días'}`
}

const shortDate = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Etiqueta de un bucket de la serie (YYYY-MM-DD): "12 oct" o, por semana, "Semana del 12 oct".
export function formatBucket(day: string, bucket: AdminMetrics['bucket']) {
  const label = shortDate.format(new Date(`${day}T00:00:00Z`)).replace('.', '')
  return bucket === 'week' ? `Semana del ${label}` : label
}

export function formatAxisDate(day: string) {
  return shortDate.format(new Date(`${day}T00:00:00Z`)).replace('.', '')
}
