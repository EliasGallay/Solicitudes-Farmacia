import { areaName, type Area } from './areas'
import { vehicleLabel } from './fleet'
import { notificationHref, notificationText } from './notifications'
import { relationOne } from './requests'
import type { AppRole } from './session'

// Armado de notificaciones para mostrar, compartido por /notificaciones y el panel de la campana
// (/api/notificaciones/recientes). Separado de notifications.ts porque usa módulos de servidor.

// Cada notificación es de una solicitud de insumos (request_id) o de una solicitud de servicio de
// Movilidad (vehicle_request_id).
export const NOTIFICATION_SELECT = 'id, kind, request_id, vehicle_request_id, created_at, read_at, request:requests(request_number, area, health_center:health_centers(name)), delivery:deliveries(delivery_number), vehicle_request:vehicle_requests(request_number, vehicle:vehicles(name, plate, internal_code))'

type RequestRelation = { request_number: number; area: string; health_center: { name: string } | { name: string }[] | null }
type DeliveryRelation = { delivery_number: number }
type VehicleRelation = { name: string; plate: string; internal_code: string | null }
type VehicleRequestRelation = { request_number: number; vehicle: VehicleRelation | VehicleRelation[] | null }

export type NotificationRow = {
  id: string
  kind: string
  request_id: string | null
  vehicle_request_id: string | null
  created_at: string
  read_at: string | null
  request: RequestRelation | RequestRelation[] | null
  delivery: DeliveryRelation | DeliveryRelation[] | null
  vehicle_request: VehicleRequestRelation | VehicleRequestRelation[] | null
}

export type NotificationItem = { id: string; title: string; body: string; href: string; createdAt: string; unread: boolean }

export function toNotificationItem(row: NotificationRow, role: AppRole | null, areas: Area[]): NotificationItem {
  const request = relationOne(row.request)
  const vehicleRequest = relationOne(row.vehicle_request)
  const vehicle = relationOne(vehicleRequest?.vehicle ?? null)
  const { title, body } = notificationText({
    kind: row.kind,
    recipientRole: role,
    requestNumber: request?.request_number ?? vehicleRequest?.request_number ?? null,
    deliveryNumber: relationOne(row.delivery)?.delivery_number ?? null,
    centerName: relationOne(request?.health_center ?? null)?.name ?? null,
    areaName: request ? areaName(areas, request.area) : null,
    vehicleName: vehicle ? vehicleLabel(vehicle) : null,
  })
  return { id: row.id, title, body, href: notificationHref(row.kind, (row.vehicle_request_id ?? row.request_id)!), createdAt: row.created_at, unread: !row.read_at }
}
