import { areaName, type Area } from './areas'
import { notificationHref, notificationText } from './notifications'
import { relationOne } from './requests'
import type { AppRole } from './session'

// Armado de notificaciones para mostrar, compartido por /notificaciones y el panel de la campana
// (/api/notificaciones/recientes). Separado de notifications.ts porque usa módulos de servidor.

export const NOTIFICATION_SELECT = 'id, kind, request_id, created_at, read_at, request:requests(request_number, area, health_center:health_centers(name)), delivery:deliveries(delivery_number)'

type RequestRelation = { request_number: number; area: string; health_center: { name: string } | { name: string }[] | null }
type DeliveryRelation = { delivery_number: number }

export type NotificationRow = {
  id: string
  kind: string
  request_id: string
  created_at: string
  read_at: string | null
  request: RequestRelation | RequestRelation[] | null
  delivery: DeliveryRelation | DeliveryRelation[] | null
}

export type NotificationItem = { id: string; title: string; body: string; href: string; createdAt: string; unread: boolean }

export function toNotificationItem(row: NotificationRow, role: AppRole | null, areas: Area[]): NotificationItem {
  const request = relationOne(row.request)
  const { title, body } = notificationText({
    kind: row.kind,
    recipientRole: role,
    requestNumber: request?.request_number ?? null,
    deliveryNumber: relationOne(row.delivery)?.delivery_number ?? null,
    centerName: relationOne(request?.health_center ?? null)?.name ?? null,
    areaName: request ? areaName(areas, request.area) : null,
  })
  return { id: row.id, title, body, href: notificationHref(row.kind, row.request_id), createdAt: row.created_at, unread: !row.read_at }
}
