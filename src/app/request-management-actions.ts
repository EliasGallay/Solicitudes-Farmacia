'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { feedbackMessage, withFeedback } from '../lib/feedback'
import { closureReasons, managementErrorCode, NOTE_MAX_LENGTH, receiptResolutions } from '../lib/request-management'
import { requireRole, requireSession } from '../lib/session'

// Gestión de solicitudes (docs/plans/plan-gestion-solicitudes.md). Cada acción llama a una RPC de
// supabase/migrations/202610020001_request_management.sql, que vuelve a validar rol, saldos y
// permisos dentro de una transacción: la validación de acá es solo para responder rápido.

const idSchema = z.string().uuid()
const noteSchema = z.string().trim().max(NOTE_MAX_LENGTH)
const deliveryLinesSchema = z.array(z.object({ request_item_id: z.string().uuid(), quantity: z.number().int().min(0) })).min(1)

// Estado, listados, indicadores y remitos dependen de estas operaciones.
function revalidateRequest(requestId: string) {
  revalidatePath('/')
  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${requestId}`)
  revalidatePath('/entregas', 'layout')
}

// Formulario cliente de /solicitudes/[id]/entregar: devuelve el error para mostrarlo sin perder lo cargado.
export async function registerDelivery(requestId: string, lines: { request_item_id: string; quantity: number }[], note: string): Promise<{ error: string }> {
  const id = idSchema.safeParse(requestId)
  const parsedLines = deliveryLinesSchema.safeParse(lines)
  const parsedNote = noteSchema.safeParse(note)
  if (!id.success || !parsedLines.success) return { error: feedbackMessage('gestion-datos-invalidos')! }
  if (!parsedNote.success) return { error: feedbackMessage('gestion-nota-larga')! }
  if (!parsedLines.data.some((line) => line.quantity > 0)) return { error: feedbackMessage('gestion-entrega-vacia')! }

  const { supabase } = await requireRole('admin')
  const { data: deliveryId, error } = await supabase.rpc('register_delivery', { target_request_id: id.data, delivery_lines: parsedLines.data, delivery_note: parsedNote.data || null })
  if (error || !deliveryId) return { error: feedbackMessage(managementErrorCode(error, 'gestion-error'))! }

  revalidateRequest(id.data)
  // ?remito=: el detalle ofrece imprimir el remito recién creado.
  redirect(withFeedback(`/solicitudes/${id.data}?remito=${deliveryId}`, 'success', 'entrega-registrada'))
}

const closeSchema = z.object({
  request_id: idSchema,
  reason: z.enum(closureReasons),
  detail: noteSchema.optional(),
  items: z.array(idSchema).min(1),
})

// /solicitudes/[id]/cerrar: cierra todo lo pendiente de los productos elegidos.
export async function closePending(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirect(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}/cerrar`

  const parsed = closeSchema.safeParse({ request_id: requestId.data, reason: formData.get('reason') || undefined, detail: formData.get('detail') ?? undefined, items: formData.getAll('item') })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.path[0]
    redirect(withFeedback(page, 'error', issue === 'reason' ? 'gestion-motivo-requerido' : issue === 'items' ? 'gestion-sin-pendiente' : issue === 'detail' ? 'gestion-nota-larga' : 'gestion-datos-invalidos'))
  }
  const { reason, detail, items } = parsed.data
  if (reason === 'otro' && !detail) redirect(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  // Sin `quantity`: la base cierra todo el pendiente de cada ítem, calculado con la solicitud bloqueada.
  const lines = [...new Set(items)].map((itemId) => ({ request_item_id: itemId }))
  const { error } = await supabase.rpc('close_request_items', { target_request_id: requestId.data, closure_items: lines, closure_reason: reason, closure_detail: detail || null })
  if (error) redirect(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirect(withFeedback(`/solicitudes/${requestId.data}`, 'success', 'pendiente-cerrado'))
}

// Anulación desde el detalle de la solicitud o de la entrega (`from`), que es adonde se vuelve.
export async function voidDelivery(formData: FormData) {
  const deliveryId = idSchema.safeParse(formData.get('delivery_id'))
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!deliveryId.success || !requestId.success) redirect(withFeedback('/entregas', 'error', 'gestion-datos-invalidos'))
  const page = formData.get('from') === 'entrega' ? `/entregas/${deliveryId.data}` : `/solicitudes/${requestId.data}`

  const reason = noteSchema.safeParse(formData.get('reason') ?? '')
  if (!reason.success) redirect(withFeedback(page, 'error', 'gestion-nota-larga'))
  if (!reason.data) redirect(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('void_delivery', { target_delivery_id: deliveryId.data, reason: reason.data })
  if (error) redirect(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirect(withFeedback(page, 'success', 'entrega-anulada'))
}

const receiptLinesSchema = z.array(z.object({
  delivery_item_id: z.string().uuid(),
  received_quantity: z.number().int().min(0),
  comment: noteSchema.optional(),
})).min(1)

// Formulario cliente de /solicitudes/[id]/recibir: el solicitante confirma lo que llegó, línea por línea.
export async function confirmReceipt(requestId: string, lines: { delivery_item_id: string; received_quantity: number; comment?: string }[]): Promise<{ error: string }> {
  const id = idSchema.safeParse(requestId)
  const parsed = receiptLinesSchema.safeParse(lines)
  if (!id.success) return { error: feedbackMessage('gestion-datos-invalidos')! }
  if (!parsed.success) return { error: feedbackMessage(parsed.error.issues[0]?.path.includes('comment') ? 'gestion-nota-larga' : 'recepcion-vacia')! }

  const { supabase, role } = await requireSession()
  if (role !== 'requester') return { error: feedbackMessage('gestion-datos-invalidos')! }
  const { error } = await supabase.rpc('confirm_receipt', { target_request_id: id.data, receipt_lines: parsed.data.map((line) => ({ ...line, comment: line.comment || null })) })
  if (error) return { error: feedbackMessage(managementErrorCode(error, 'gestion-error'))! }

  // Se puede confirmar una parte: el mensaje avisa si quedan productos sin confirmar.
  const { data: request } = await supabase.from('requests').select('receipt_unconfirmed_count').eq('id', id.data).maybeSingle()
  const remaining = (request?.receipt_unconfirmed_count as number | undefined) ?? 0

  revalidateRequest(id.data)
  redirect(withFeedback(`/solicitudes/${id.data}`, 'success', remaining > 0 ? 'recepcion-confirmada-parcial' : 'recepcion-confirmada'))
}

// Resolución de una diferencia de recepción desde el detalle de la solicitud (solo admin). El botón
// que envía el form define la resolución (name="resolution").
export async function resolveReceiptDifference(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  const receiptId = idSchema.safeParse(formData.get('receipt_id'))
  if (!requestId.success || !receiptId.success) redirect(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const resolution = z.enum(receiptResolutions).safeParse(formData.get('resolution'))
  const note = noteSchema.safeParse(formData.get('note') ?? '')
  if (!resolution.success) redirect(withFeedback(page, 'error', 'gestion-motivo-requerido'))
  if (!note.success) redirect(withFeedback(page, 'error', 'gestion-nota-larga'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('resolve_receipt_difference', { target_receipt_id: receiptId.data, target_resolution: resolution.data, target_note: note.data || null })
  if (error) redirect(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirect(withFeedback(page, 'success', 'diferencia-resuelta'))
}

// Cancelación por el solicitante mientras no haya entregas activas (la base lo valida).
export async function cancelRequest(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirect(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const { supabase, role } = await requireSession()
  if (role !== 'requester') redirect(withFeedback(page, 'error', 'gestion-datos-invalidos'))
  const { error } = await supabase.rpc('cancel_request', { target_request_id: requestId.data })
  if (error) redirect(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirect(withFeedback(page, 'success', 'solicitud-cancelada'))
}
