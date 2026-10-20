import { CalendarClock, ChartColumn, ClipboardList, PackageCheck, Truck } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarList, ColumnLabels, Columns, Donut, Legend, StackedBars } from './breakdown-charts'
import { StatTile } from './stat-tile'
import { TrendChart } from './trend-chart'
import { formatAxisDate, formatBucket, formatHours, getAdminMetrics, metricPeriodLabels, percent, relativeChange, type AdminMetrics, type MetricPeriod } from '@/lib/admin-metrics'
import { formatCount } from '@/lib/chart'
import { listHref } from '@/lib/filters'
import { closureReasonLabels } from '@/lib/request-management'
import { shiftDate, WAIT_WARNING_DAYS } from '@/lib/requests'
import { requireSession } from '@/lib/session'

// Colores de rubro por orden alfabético del nombre (no por ranking): un rubro conserva su color al cambiar el período.
const AREA_COLORS = [
  { stroke: 'stroke-chart-1', swatch: 'bg-chart-1' },
  { stroke: 'stroke-chart-2', swatch: 'bg-chart-2' },
  { stroke: 'stroke-chart-3', swatch: 'bg-chart-3' },
  { stroke: 'stroke-chart-4', swatch: 'bg-chart-4' },
]
const OTHER_COLOR = { stroke: 'stroke-foreground-muted', swatch: 'bg-foreground-muted' }

// Estado de las unidades pedidas: mismos significados que los badges de estado.
const UNIT_STATES = [
  { key: 'delivered', label: 'Entregadas', swatch: 'bg-chart-1' },
  { key: 'pending', label: 'Pendientes', swatch: 'bg-warning' },
  { key: 'closed', label: 'Cerradas sin entregar', swatch: 'bg-foreground-muted' },
] as const

export async function AdminMetricsSection({ period }: { period: MetricPeriod }) {
  const { supabase } = await requireSession()
  const metrics = await getAdminMetrics(supabase, period)
  if (!metrics) return <Card><ErrorState title="No pudimos cargar las métricas" /></Card>
  return <AdminMetricsView metrics={metrics} period={period} />
}

export function AdminMetricsView({ metrics, period }: { metrics: AdminMetrics; period: MetricPeriod }) {
  const { kpis } = metrics
  const comparedTo = `los ${metricPeriodLabels[period]} anteriores`
  const fillRate = percent(kpis.units_delivered, kpis.units_requested)
  const fillRatePrev = percent(kpis.units_delivered_prev, kpis.units_requested_prev)
  const firstDeliveryChange = kpis.first_delivery_hours !== null && kpis.first_delivery_hours_prev
    ? Math.round(((kpis.first_delivery_hours - kpis.first_delivery_hours_prev) / kpis.first_delivery_hours_prev) * 100)
    : null

  const labels = metrics.series.map((point) => formatBucket(point.day, metrics.bucket))
  const requestsTrend = metrics.series.map((point) => point.requests)
  const deliveriesTrend = metrics.series.map((point) => point.deliveries)

  const areaOrder = [...metrics.areas].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((area) => area.key)
  const areasWithData = metrics.areas.filter((area) => area.requests > 0)
  const shownAreas = metrics.areas.filter((area) => areaOrder.indexOf(area.key) < AREA_COLORS.length)
  const otherAreas = metrics.areas.filter((area) => areaOrder.indexOf(area.key) >= AREA_COLORS.length)
  const areaSegments = [
    ...shownAreas.map((area) => ({ key: area.key, label: area.name, value: area.requests, ...AREA_COLORS[areaOrder.indexOf(area.key)] })),
    ...(otherAreas.length ? [{ key: 'otros', label: 'Otros rubros', value: otherAreas.reduce((sum, area) => sum + area.requests, 0), ...OTHER_COLOR }] : []),
  ]

  const centersWithData = metrics.centers.filter((center) => center.delivered + center.pending + center.closed > 0)
  const today = metrics.to
  const aging = [
    { key: 'd0_2', label: '0 a 2 días', value: metrics.aging.d0_2, late: false, filters: { desde: shiftDate(today, -2) } },
    { key: 'd3_6', label: '3 a 6 días', value: metrics.aging.d3_6, late: true, filters: { desde: shiftDate(today, -6), hasta: shiftDate(today, -3) } },
    { key: 'd7_13', label: '7 a 13 días', value: metrics.aging.d7_13, late: true, filters: { desde: shiftDate(today, -13), hasta: shiftDate(today, -7) } },
    { key: 'd14', label: '14 días o más', value: metrics.aging.d14, late: true, filters: { hasta: shiftDate(today, -14) } },
  ]
  const openTotal = aging.reduce((sum, bucket) => sum + bucket.value, 0)
  const lateTotal = aging.filter((bucket) => bucket.late).reduce((sum, bucket) => sum + bucket.value, 0)
  const differenceRate = percent(metrics.receipts.with_difference, metrics.receipts.lines)
  const closedUnits = metrics.closures.reduce((sum, closure) => sum + closure.units, 0)

  return (
    <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:col-span-3 xl:grid-cols-4">
        <StatTile icon={ClipboardList} label="Solicitudes recibidas" value={formatCount(kpis.requests)} detail={`${formatCount(kpis.units_requested)} unidades pedidas`} trend={requestsTrend} delta={{ value: relativeChange(kpis.requests, kpis.requests_prev), unit: '%', better: 'up', comparedTo }} />
        <StatTile icon={Truck} label="Entregas realizadas" value={formatCount(kpis.deliveries)} detail="Remitos activos (sin anulados)" trend={deliveriesTrend} delta={{ value: relativeChange(kpis.deliveries, kpis.deliveries_prev), unit: '%', better: 'up', comparedTo }} />
        <StatTile icon={PackageCheck} label="Unidades entregadas" value={fillRate === null ? '—' : `${fillRate} %`} detail={`${formatCount(kpis.units_delivered)} de ${formatCount(kpis.units_requested)} pedidas en el período`} delta={{ value: fillRate !== null && fillRatePrev !== null ? fillRate - fillRatePrev : null, unit: 'pp', better: 'up', comparedTo }} />
        <StatTile icon={CalendarClock} label="Tiempo hasta la primera entrega" value={formatHours(kpis.first_delivery_hours)} detail="Mediana desde que se crea la solicitud" delta={{ value: firstDeliveryChange, unit: '%', better: 'down', comparedTo }} />
      </div>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Solicitudes y entregas</CardTitle>
          <CardDescription>{metrics.bucket === 'week' ? 'Por semana' : 'Por día'}, en los últimos {metricPeriodLabels[period]}.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            labels={labels}
            axisLabels={metrics.series.map((point) => formatAxisDate(point.day))}
            series={[
              { key: 'requests', label: 'Solicitudes', color: 'chart-2', values: requestsTrend },
              { key: 'deliveries', label: 'Entregas', color: 'chart-1', values: deliveriesTrend },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes por rubro</CardTitle>
          <CardDescription>Cómo se reparte la demanda del período.</CardDescription>
        </CardHeader>
        <CardContent>
          {areasWithData.length > 0
            ? <Donut segments={areaSegments} centerLabel="solicitudes" />
            : <NoData />}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Cumplimiento por centro de salud</CardTitle>
            <CardDescription>Unidades pedidas en el período según su estado actual.</CardDescription>
          </div>
          <Legend items={UNIT_STATES.map(({ label, swatch }) => ({ label, swatch }))} />
        </CardHeader>
        <CardContent>
          {centersWithData.length > 0
            ? (
              <StackedBars rows={centersWithData.map((center) => {
                const total = center.delivered + center.pending + center.closed
                return {
                  key: center.id,
                  label: center.name,
                  note: <><span className="font-semibold text-foreground">{percent(center.delivered, total)} %</span> entregado · {formatCount(center.requests)} {center.requests === 1 ? 'solicitud' : 'solicitudes'}</>,
                  segments: UNIT_STATES.map((state) => ({ ...state, value: center[state.key] })),
                }
              })} />
            )
            : <NoData />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Antigüedad de lo pendiente</CardTitle>
          <CardDescription>
            {openTotal === 0
              ? 'No hay solicitudes con pendiente.'
              : <><span className="font-semibold text-foreground">{lateTotal}</span> de {openTotal} {openTotal === 1 ? 'solicitud abierta espera' : 'solicitudes abiertas esperan'} {WAIT_WARNING_DAYS} días o más. Hoy, sin importar el período.</>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Columns columns={aging.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            value: bucket.value,
            swatch: bucket.late ? 'bg-warning' : 'bg-chart-1',
            href: listHref('/solicitudes', bucket.filters),
            hint: `${bucket.label}: ver solicitudes`,
          }))} />
          <ColumnLabels labels={aging.map((bucket) => bucket.label)} />
          <Legend items={[{ label: 'En plazo', swatch: 'bg-chart-1' }, { label: `Demoradas (${WAIT_WARNING_DAYS}+ días)`, swatch: 'bg-warning' }]} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Productos más pedidos</CardTitle>
          <CardDescription>Unidades pedidas en el período; debajo, lo que sigue pendiente.</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.top_products.length > 0
            ? <BarList unit="unidades" rows={metrics.top_products.map((product, index) => ({
              key: `${product.name}-${product.presentation}-${index}`,
              label: product.name,
              sublabel: product.presentation,
              value: product.requested,
              detail: product.pending > 0 ? `${formatCount(product.pending)} pendientes` : 'Sin pendiente',
            }))} />
            : <NoData />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calidad de las entregas</CardTitle>
          <CardDescription>Recepciones, anulaciones y cierres del período.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm leading-5 text-foreground-secondary">Líneas recibidas sin diferencia</span>
              <span className="text-lg leading-6 font-bold text-foreground">{differenceRate === null ? '—' : `${100 - differenceRate} %`}</span>
            </div>
            <div className="flex h-2 gap-0.5 rounded-full bg-surface-muted" aria-hidden>
              {metrics.receipts.lines > 0 && (
                <>
                  <span className="h-full rounded-l-full bg-chart-1" style={{ flexGrow: metrics.receipts.lines - metrics.receipts.with_difference }} />
                  {metrics.receipts.with_difference > 0 && <span className="h-full rounded-r-full bg-warning" style={{ flexGrow: metrics.receipts.with_difference }} />}
                </>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-4 text-foreground-muted">{formatCount(metrics.receipts.lines)} líneas confirmadas por los centros.</p>
          </div>

          <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-3 text-center">
            <QualityStat label="Con diferencia" value={metrics.receipts.with_difference} />
            <QualityStat label="Producto equivocado" value={metrics.receipts.wrong_product} />
            <QualityStat label="Remitos anulados" value={metrics.receipts.voided_deliveries} />
          </dl>

          <div>
            <p className="mb-3 text-sm leading-5 font-semibold text-foreground">Unidades cerradas sin entregar <span className="font-normal text-foreground-muted">· {formatCount(closedUnits)}</span></p>
            {metrics.closures.length > 0
              ? <BarList unit="unidades" rows={metrics.closures.map((closure) => ({ key: closure.reason, label: closureReasonLabels[closure.reason] ?? closure.reason, value: closure.units }))} />
              : <p className="text-sm leading-5 text-foreground-muted">No hubo cierres en el período.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QualityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse gap-0.5">
      <dt className="text-xs leading-4 text-foreground-secondary">{label}</dt>
      <dd className="text-xl leading-7 font-bold text-foreground">{formatCount(value)}</dd>
    </div>
  )
}

function NoData() {
  return <EmptyState icon={ChartColumn} title="Sin datos en el período">Probá con un período más largo.</EmptyState>
}
