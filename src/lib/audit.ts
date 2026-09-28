// Acciones que escriben las RPCs y triggers de supabase/migrations/202610020001_request_management.sql.
export const auditActions = ['request.created', 'request.cancelled', 'delivery.registered', 'delivery.voided', 'items.closed', 'delivery.received', 'receipt.resolved'] as const
export type AuditAction = (typeof auditActions)[number]

export const auditActionLabels: Record<AuditAction, string> = {
  'request.created': 'Solicitud creada',
  'request.cancelled': 'Solicitud cancelada',
  'delivery.registered': 'Entrega registrada',
  'delivery.voided': 'Entrega anulada',
  'items.closed': 'Pendiente cerrado',
  'delivery.received': 'Recepción confirmada',
  'receipt.resolved': 'Diferencia de recepción resuelta',
}

// Etiqueta de una acción; las desconocidas (futuras) se muestran tal cual.
export function auditActionLabel(action: string) {
  return Object.hasOwn(auditActionLabels, action) ? auditActionLabels[action as AuditAction] : action
}

// Enlace a la entidad afectada, si tiene pantalla propia.
export function auditEntityHref(entityType: string, entityId: string) {
  if (entityType === 'request') return `/solicitudes/${entityId}`
  if (entityType === 'delivery') return `/entregas/${entityId}`
  return null
}
