// Cantidades calculadas por la base (columnas computadas de request_items,
// supabase/migrations/202609240001_request_item_quantities.sql).
export type ItemQuantitiesRow = { requested_quantity: number; delivered_quantity: number; pending_quantity: number; closed_quantity?: number }

const dateFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// Debe coincidir con el check requests_observations_check de la base.
export const OBSERVATIONS_MAX_LENGTH = 500

export function formatRequestNumber(value: number) {
  return `#SOL-${value}`
}

// Número de remito (deliveries.delivery_number).
export function formatDeliveryNumber(value: number) {
  return `#REM-${value}`
}

// Acepta "15", "#15", "REM-15" o "#REM-15"; devuelve null si no es un número de remito.
export function parseDeliveryNumber(value: string) {
  const match = value.trim().match(/^#?\s*(?:rem-?\s*)?(\d{1,15})$/i)
  return match ? Number(match[1]) : null
}

// Días de espera a partir de los cuales una solicitud abierta se resalta en la bandeja del admin.
export const WAIT_WARNING_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000
const isoDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' })

// Fecha calendario en Argentina (YYYY-MM-DD), el formato de los filtros de fecha.
export function argentinaDate(value: string | number | Date) {
  return isoDateFormat.format(new Date(value))
}

// Suma (o resta) días a una fecha YYYY-MM-DD.
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

// Días calendario (en Argentina) desde `since` hasta `now`: una solicitud de ayer espera 1 día
// aunque no hayan pasado 24 horas. Coincide con los filtros por fecha del listado.
export function waitDays(since: string, now: number = Date.now()) {
  const from = new Date(`${argentinaDate(since)}T00:00:00Z`).getTime()
  const to = new Date(`${argentinaDate(now)}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((to - from) / DAY_MS))
}

export function formatWait(days: number) {
  if (days === 0) return 'Hoy'
  return days === 1 ? '1 día' : `${days} días`
}

// Acepta "1024", "#1024", "SOL-1024" o "#SOL-1024"; devuelve null si no es un número de solicitud.
export function parseRequestNumber(value: string) {
  const match = value.trim().match(/^#?\s*(?:sol-?\s*)?(\d{1,15})$/i)
  return match ? Number(match[1]) : null
}

export function formatDate(value: string) {
  return dateFormat.format(new Date(value))
}

export function formatDateTime(value: string) {
  return `${formatDate(value)} ${timeFormat.format(new Date(value))}`
}

// Embedded many-to-one relations may come back as an object or a single-element array.
export function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export function summarizeItems(items: ItemQuantitiesRow[]) {
  const summary = { products: 0, requested: 0, delivered: 0, closed: 0, pending: 0 }
  for (const item of items) {
    summary.products += 1
    summary.requested += item.requested_quantity
    summary.delivered += item.delivered_quantity
    summary.closed += item.closed_quantity ?? 0
    summary.pending += item.pending_quantity
  }
  return summary
}
