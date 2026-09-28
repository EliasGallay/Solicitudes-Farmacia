import type { FeedbackCode } from './feedback'

// Motivos de cierre (check de public.request_item_closures.reason). Los que elige el admin al cerrar
// pendiente; 'cancelada' lo usa cancel_request y 'no_recibido' la resolución de una diferencia.
export const closureReasons = ['sin_stock', 'discontinuado', 'rechazado', 'duplicado', 'otro'] as const
export type ClosureReason = (typeof closureReasons)[number] | 'cancelada' | 'no_recibido'

export const closureReasonLabels: Record<ClosureReason, string> = {
  sin_stock: 'Sin stock',
  discontinuado: 'Discontinuado',
  rechazado: 'Rechazado',
  duplicado: 'Duplicado',
  otro: 'Otro',
  cancelada: 'Cancelada por el solicitante',
  no_recibido: 'No recibido por el centro',
}

// Resolución de una diferencia de recepción (delivery_item_receipts.resolution,
// supabase/migrations/202610040001_delivery_receipts.sql).
export const receiptResolutions = ['reenviar', 'cerrar'] as const
export type ReceiptResolution = (typeof receiptResolutions)[number]

export const receiptResolutionLabels: Record<ReceiptResolution, string> = {
  reenviar: 'el faltante vuelve a pendiente para reenviarlo',
  cerrar: 'el faltante se cierra sin reenviar',
}

// Debe coincidir con los checks de longitud de notas y motivos en la base.
export const NOTE_MAX_LENGTH = 500

// Errores que las RPCs de gestión lanzan con un código corto como mensaje. Cualquier otro error se
// informa con `fallback` (no se muestran mensajes técnicos).
const rpcErrorCodes: Record<string, FeedbackCode> = {
  'sobreentrega': 'gestion-sobreentrega',
  'entrega-vacia': 'gestion-entrega-vacia',
  'sin-pendiente': 'gestion-sin-pendiente',
  'motivo-requerido': 'gestion-motivo-requerido',
  'ya-anulada': 'gestion-ya-anulada',
  'con-entregas': 'gestion-con-entregas',
  'nota-larga': 'gestion-nota-larga',
  'item-invalido': 'gestion-datos-invalidos',
  'cantidad-invalida': 'gestion-datos-invalidos',
  'solicitud-invalida': 'gestion-datos-invalidos',
  'entrega-invalida': 'gestion-datos-invalidos',
  'recepcion-vacia': 'recepcion-vacia',
  'ya-confirmado': 'recepcion-ya-confirmada',
  'comentario-requerido': 'recepcion-comentario-requerido',
  'entrega-anulada': 'recepcion-entrega-anulada',
  'ya-resuelta': 'diferencia-ya-resuelta',
  'sin-diferencia': 'gestion-datos-invalidos',
  'con-recepcion': 'gestion-con-recepcion',
}

export function managementErrorCode(error: { message?: string } | null, fallback: FeedbackCode): FeedbackCode {
  const message = error?.message
  return message && Object.hasOwn(rpcErrorCodes, message) ? rpcErrorCodes[message] : fallback
}
