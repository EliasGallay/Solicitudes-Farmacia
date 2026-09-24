import { z } from 'zod'

// Estados calculados en la base (supabase/migrations/202609240002_request_status.sql).
export const requestStatuses = ['pending', 'partial', 'completed', 'closed'] as const
export type RequestStatus = (typeof requestStatuses)[number]

export const requestStatusLabels: Record<RequestStatus, string> = {
  pending: 'Pendiente',
  partial: 'Entrega parcial',
  completed: 'Completada',
  closed: 'Cerrada',
}

export const requestStatusSchema = z.enum(requestStatuses)
export const statusParamSchema = requestStatusSchema.optional().catch(undefined)
