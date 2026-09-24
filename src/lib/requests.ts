// Cantidades calculadas por la base (columnas computadas de request_items,
// supabase/migrations/202609240001_request_item_quantities.sql).
export type ItemQuantitiesRow = { requested_quantity: number; delivered_quantity: number; pending_quantity: number }

const dateFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// Debe coincidir con el check requests_observations_check de la base.
export const OBSERVATIONS_MAX_LENGTH = 500

export function formatRequestNumber(value: number) {
  return `#SOL-${value}`
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
  const summary = { products: 0, requested: 0, delivered: 0, pending: 0 }
  for (const item of items) {
    summary.products += 1
    summary.requested += item.requested_quantity
    summary.delivered += item.delivered_quantity
    summary.pending += item.pending_quantity
  }
  return summary
}
