// Acciones que escriben las RPCs y triggers de supabase/migrations/202610020001_request_management.sql
// y, para Movilidad, de 202610280001_fleet.sql.
export const auditActions = [
  'request.created', 'request.cancelled', 'request.purchase_requirement', 'delivery.registered', 'delivery.voided', 'items.closed', 'closure.voided', 'request.edited', 'delivery.received', 'delivery.signed_note', 'receipt.resolved', 'request.comment',
  'vehicle.created', 'vehicle.updated', 'vehicle.deactivated', 'vehicle.activated', 'vehicle_record.created', 'vehicle_record.voided',
  'vehicle_request.created', 'vehicle_request.purchase_requirement', 'vehicle_request.completed', 'vehicle_request.cancelled',
  'fleet_evidence.added', 'fleet_evidence.deleted',
] as const
export type AuditAction = (typeof auditActions)[number]

export const auditActionLabels: Record<AuditAction, string> = {
  'request.created': 'Solicitud creada',
  'request.cancelled': 'Solicitud cancelada',
  'request.purchase_requirement': 'Requerimiento de compra',
  'delivery.registered': 'Entrega registrada',
  'delivery.voided': 'Entrega anulada',
  'items.closed': 'Pendiente cerrado',
  'closure.voided': 'Cierre anulado',
  'request.edited': 'Solicitud corregida',
  'delivery.received': 'Recepción confirmada',
  'delivery.signed_note': 'Remito firmado adjuntado',
  'receipt.resolved': 'Diferencia de recepción resuelta',
  'request.comment': 'Comentario agregado',
  'vehicle.created': 'Vehículo creado',
  'vehicle.updated': 'Vehículo actualizado',
  'vehicle.deactivated': 'Vehículo desactivado',
  'vehicle.activated': 'Vehículo activado',
  'vehicle_record.created': 'Registro de vehículo cargado',
  'vehicle_record.voided': 'Registro de vehículo anulado',
  'vehicle_request.created': 'Solicitud de servicio creada',
  'vehicle_request.purchase_requirement': 'Requerimiento de compra (Movilidad)',
  'vehicle_request.completed': 'Solicitud de servicio completada',
  'vehicle_request.cancelled': 'Solicitud de servicio cancelada',
  'fleet_evidence.added': 'Archivo adjuntado (Movilidad)',
  'fleet_evidence.deleted': 'Archivo borrado (Movilidad)',
}

// Etiqueta de una acción; las desconocidas (futuras) se muestran tal cual.
export function auditActionLabel(action: string) {
  return Object.hasOwn(auditActionLabels, action) ? auditActionLabels[action as AuditAction] : action
}

// Enlace a la entidad afectada, si tiene pantalla propia.
export function auditEntityHref(entityType: string, entityId: string) {
  if (entityType === 'request') return `/solicitudes/${entityId}`
  if (entityType === 'delivery') return `/entregas/${entityId}`
  if (entityType === 'vehicle') return `/movilidad/vehiculos/${entityId}`
  if (entityType === 'vehicle_request') return `/movilidad/solicitudes/${entityId}`
  return null
}
