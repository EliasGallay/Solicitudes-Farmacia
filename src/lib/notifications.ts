import { formatDeliveryNumber, formatRequestNumber } from './requests'
import type { AppRole } from './session'
import type { createSupabaseServerClient } from './supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

// Tipos que genera el trigger notify_from_audit (supabase/migrations/202610080001_notifications.sql).
export const notificationKinds = ['request.created', 'request.cancelled', 'delivery.registered', 'delivery.voided', 'items.closed', 'delivery.received', 'receipt.difference', 'receipt.resolved'] as const
export type NotificationKind = (typeof notificationKinds)[number]

// Cada cuánto el shell vuelve a consultar las no leídas (además de al navegar y al volver a la pestaña).
export const NOTIFICATIONS_POLL_MS = 60_000

export type NotificationContext = {
  kind: string
  // Rol de quien la recibe: el admin ve de qué centro es la solicitud; el centro, que es de su centro.
  recipientRole: AppRole | null
  requestNumber: number | null
  deliveryNumber: number | null
  centerName: string | null
  areaName: string | null
}

// Título y detalle de una notificación. Toda operación sobre una solicitud se notifica al admin y al
// centro, así que cada texto tiene la versión de cada uno. Los datos de la solicitud pueden faltar
// si quien la recibe ya no la puede ver (por ejemplo, le quitaron el rubro): se muestra un texto genérico.
export function notificationText(context: NotificationContext): { title: string; body: string } {
  const admin = context.recipientRole === 'admin'
  const number = context.requestNumber != null ? formatRequestNumber(context.requestNumber) : null
  const area = context.areaName ? ` (${context.areaName})` : ''
  // "la solicitud #SOL-12 de CAPS Norte" para el admin; "la solicitud #SOL-12 de tu centro" para el centro.
  const owner = admin ? (context.centerName ? ` de ${context.centerName}` : '') : ' de tu centro'
  const request = number ? `la solicitud ${number}${owner}` : 'una solicitud'
  const delivery = context.deliveryNumber != null ? `la entrega ${formatDeliveryNumber(context.deliveryNumber)}` : 'una entrega'
  const center = context.centerName ?? 'El centro'

  switch (context.kind) {
    case 'request.created':
      return admin
        ? { title: 'Solicitud nueva', body: `${center} envió ${number ? `la solicitud ${number}` : 'una solicitud'}${area}.` }
        : { title: 'Solicitud nueva', body: `Se cargó ${request}${area}.` }
    case 'request.cancelled':
      return { title: 'Solicitud cancelada', body: `Se canceló ${request}${area}.` }
    case 'delivery.registered':
      return admin
        ? { title: 'Entrega registrada', body: `Se registró ${delivery} de ${request}.` }
        : { title: 'Entrega registrada', body: `Se registró ${delivery} de ${request}. Confirmá la recepción cuando llegue.` }
    case 'delivery.voided':
      return { title: 'Entrega anulada', body: `Se anuló ${delivery} de ${request}. Sus cantidades volvieron a quedar pendientes.` }
    case 'items.closed':
      return { title: 'Pendiente cerrado', body: `Se cerraron cantidades pendientes de ${request}: no se van a entregar.` }
    case 'delivery.received':
      return { title: 'Recepción confirmada', body: `Se confirmó la recepción de lo entregado en ${request}, sin diferencias.` }
    case 'receipt.difference':
      return admin
        ? { title: 'Diferencia en la recepción', body: `${center} informó que recibió menos de lo entregado en ${number ? `la solicitud ${number}` : 'una solicitud'}. Revisala para reenviar o cerrar el faltante.` }
        : { title: 'Diferencia en la recepción', body: `Se informó que llegó menos de lo entregado en ${request}. La administración la va a revisar.` }
    case 'receipt.resolved':
      return { title: 'Diferencia resuelta', body: `Se resolvió la diferencia de recepción de ${request}.` }
    default:
      return { title: 'Novedad', body: `Hay una novedad en ${request}.` }
  }
}

// Pantalla a la que lleva la notificación. La entrega registrada lleva directo a confirmar la recepción.
export function notificationHref(kind: string, requestId: string) {
  if (kind === 'delivery.registered') return `/solicitudes/${requestId}/recibir`
  return `/solicitudes/${requestId}`
}

// Cuántas muestra el panel de la campana; el resto se ve en /notificaciones.
export const RECENT_NOTIFICATIONS_LIMIT = 8

const shortDateFormat = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short' })

// Tiempo relativo para el panel: "Recién", "Hace 5 min", "Hace 3 h", "Ayer", "Hace 4 días" o la fecha.
export function formatRelativeTime(value: string, now: number = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Recién'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return shortDateFormat.format(new Date(value))
}

// Texto del contador del shell: más de 99 se muestra como "99+".
export function formatUnreadCount(count: number) {
  return count > 99 ? '99+' : String(count)
}

// No leídas de quien consulta (RLS limita a las propias). Ante un error, 0: el contador no bloquea el shell.
export async function countUnreadNotifications(supabase: SupabaseClient) {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  return error ? 0 : (count ?? 0)
}
