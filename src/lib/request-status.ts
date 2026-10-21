import { z } from 'zod'

// Estados calculados en la base (supabase/migrations/202609240002_request_status.sql y
// 202610040001_delivery_receipts.sql y 202610210001_purchase_requirements.sql). 'purchase': sin
// entregas y con requerimiento de compra registrado; 'completed': todo entregado, falta que el centro
// confirme la recepción; 'received': entregado y confirmado sin diferencias abiertas.
export const requestStatuses = ['pending', 'purchase', 'partial', 'completed', 'received', 'closed'] as const
export type RequestStatus = (typeof requestStatuses)[number]

export const requestStatusLabels: Record<RequestStatus, string> = {
  pending: 'Pendiente',
  purchase: 'En compras',
  partial: 'Entrega parcial',
  completed: 'Entregada',
  received: 'Recibida',
  closed: 'Cerrada',
}

export const requestStatusSchema = z.enum(requestStatuses)
export const statusParamSchema = requestStatusSchema.optional().catch(undefined)

// Solicitudes que todavía hay que entregar (tienen pendiente).
export const openStatuses: RequestStatus[] = ['pending', 'purchase', 'partial']

// Vistas del filtro de estado en el listado, además de cada estado:
// - por_atender: lo que el admin tiene que resolver (pendiente o con diferencia de recepción);
// - por_confirmar: entregas que el centro todavía no confirmó;
// - con_diferencia: recepciones con diferencia sin resolver;
// - todos.
export const statusViews = ['por_atender', 'por_confirmar', 'con_diferencia', 'todos'] as const
export type StatusView = RequestStatus | (typeof statusViews)[number]
export const statusViewParamSchema = z.enum([...requestStatuses, ...statusViews] as const).optional().catch(undefined)

export const statusViewLabels: Record<Exclude<(typeof statusViews)[number], 'todos'>, string> = {
  por_atender: 'Por atender',
  por_confirmar: 'Por confirmar recepción',
  con_diferencia: 'Con diferencia en la recepción',
}

// Filtro PostgREST (`or`) de "En compras": sin entregas ('purchase') o con entregas parciales y
// requerimiento de compra registrado (se muestran los dos badges).
export const PURCHASE_FILTER = 'request_status.eq.purchase,and(request_status.eq.partial,purchase_requirement_number.not.is.null)'

// Filtro PostgREST (`or`) de la bandeja del admin.
export const INBOX_FILTER = 'request_status.in.(pending,purchase,partial),receipt_discrepancy_count.gt.0'
