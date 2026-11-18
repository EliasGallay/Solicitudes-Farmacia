'use server'

import { revalidatePath } from 'next/cache'
import { redirectAfterAction } from '@/lib/redirect'
import { z } from 'zod'
import { feedbackMessage, withFeedback } from '../lib/feedback'
import { closureReasons, commentSchema, managementErrorCode, NOTE_MAX_LENGTH, PURCHASE_REQUIREMENT_MAX_LENGTH, receiptResolutions } from '../lib/request-management'
import { requireRole, requireSession } from '../lib/session'
import { isSignedNoteType, SIGNED_NOTE_MAX_BYTES, SIGNED_NOTES_BUCKET, signedNotePath, type SignedNoteType } from '../lib/signed-notes'

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
  redirectAfterAction(withFeedback(`/solicitudes/${id.data}?remito=${deliveryId}`, 'success', 'entrega-registrada'))
}

// Corrección de la solicitud: cantidad nueva de un producto existente o producto agregado.
const editChangesSchema = z.array(z.union([
  z.object({ request_item_id: z.string().uuid(), quantity: z.number().int().positive() }),
  z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() }),
])).min(1)

// Formulario cliente de /solicitudes/[id]/editar: devuelve el error para mostrarlo sin perder lo cargado.
export async function editRequest(requestId: string, changes: ({ request_item_id: string; quantity: number } | { product_id: string; quantity: number })[], reason: string): Promise<{ error: string }> {
  const id = idSchema.safeParse(requestId)
  const parsedChanges = editChangesSchema.safeParse(changes)
  const parsedReason = noteSchema.safeParse(reason)
  if (!id.success) return { error: feedbackMessage('gestion-datos-invalidos')! }
  if (!parsedChanges.success) return { error: feedbackMessage(changes.length === 0 ? 'edicion-sin-cambios' : 'gestion-datos-invalidos')! }
  if (!parsedReason.success) return { error: feedbackMessage('gestion-nota-larga')! }
  if (!parsedReason.data) return { error: feedbackMessage('gestion-motivo-requerido')! }

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('edit_request_items', { target_request_id: id.data, item_changes: parsedChanges.data, edit_reason: parsedReason.data })
  if (error) return { error: feedbackMessage(managementErrorCode(error, 'gestion-error'))! }

  revalidateRequest(id.data)
  revalidatePath(`/hojas-de-pedido/${id.data}`)
  redirectAfterAction(withFeedback(`/solicitudes/${id.data}`, 'success', 'solicitud-corregida'))
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
  if (!requestId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}/cerrar`

  const parsed = closeSchema.safeParse({ request_id: requestId.data, reason: formData.get('reason') || undefined, detail: formData.get('detail') ?? undefined, items: formData.getAll('item') })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.path[0]
    redirectAfterAction(withFeedback(page, 'error', issue === 'reason' ? 'gestion-motivo-requerido' : issue === 'items' ? 'gestion-sin-pendiente' : issue === 'detail' ? 'gestion-nota-larga' : 'gestion-datos-invalidos'))
  }
  const { reason, detail, items } = parsed.data
  if (reason === 'otro' && !detail) redirectAfterAction(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  // Sin `quantity`: la base cierra todo el pendiente de cada ítem, calculado con la solicitud bloqueada.
  const lines = [...new Set(items)].map((itemId) => ({ request_item_id: itemId }))
  const { error } = await supabase.rpc('close_request_items', { target_request_id: requestId.data, closure_items: lines, closure_reason: reason, closure_detail: detail || null })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirectAfterAction(withFeedback(`/solicitudes/${requestId.data}`, 'success', 'pendiente-cerrado'))
}

// Anulación desde el detalle de la solicitud o de la entrega (`from`), que es adonde se vuelve.
export async function voidDelivery(formData: FormData) {
  const deliveryId = idSchema.safeParse(formData.get('delivery_id'))
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!deliveryId.success || !requestId.success) redirectAfterAction(withFeedback('/entregas', 'error', 'gestion-datos-invalidos'))
  const page = formData.get('from') === 'entrega' ? `/entregas/${deliveryId.data}` : `/solicitudes/${requestId.data}`

  const reason = noteSchema.safeParse(formData.get('reason') ?? '')
  if (!reason.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-nota-larga'))
  if (!reason.data) redirectAfterAction(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('void_delivery', { target_delivery_id: deliveryId.data, reason: reason.data })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirectAfterAction(withFeedback(page, 'success', 'entrega-anulada'))
}

// Anulación de una operación de cierre desde el historial de la solicitud (solo admin): llegan los
// ids de todas sus filas y el motivo.
export async function voidClosure(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const closureIds = z.array(idSchema).min(1).safeParse(formData.getAll('closure_id'))
  const reason = noteSchema.safeParse(formData.get('reason') ?? '')
  if (!closureIds.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-datos-invalidos'))
  if (!reason.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-nota-larga'))
  if (!reason.data) redirectAfterAction(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('void_closures', { target_request_id: requestId.data, closure_ids: [...new Set(closureIds.data)], reason: reason.data })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirectAfterAction(withFeedback(page, 'success', 'cierre-anulado'))
}

const receiptLineSchema = z.object({
  delivery_item_id: z.string().uuid(),
  received_quantity: z.number().int().min(0),
  comment: noteSchema.optional(),
  // Producto equivocado: llegó otra cosa; va con recibido 0 y detalle (supabase/migrations/202610190001_wrong_product_receipts.sql).
  wrong_product: z.boolean().optional(),
})
const receiptLinesSchema = z.array(receiptLineSchema).min(1)

// Formulario cliente de /solicitudes/[id]/recibir: el solicitante confirma lo que llegó, línea por línea.
export async function confirmReceipt(requestId: string, lines: { delivery_item_id: string; received_quantity: number; comment?: string; wrong_product?: boolean }[]): Promise<{ error: string }> {
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
  redirectAfterAction(withFeedback(`/solicitudes/${id.data}`, 'success', remaining > 0 ? 'recepcion-confirmada-parcial' : 'recepcion-confirmada'))
}

// Formulario cliente de /entregas/[id]/recibir: el admin adjunta el remito firmado por el centro
// (`file` en formData, ya comprimido si es foto) y confirma las líneas de esa entrega que el centro no
// confirmó. Sin líneas, solo adjunta el remito. Sin archivo, usa un remito adjuntado antes.
export async function confirmReceiptWithSignedNote(deliveryId: string, lines: { delivery_item_id: string; received_quantity: number; comment?: string; wrong_product?: boolean }[], formData: FormData): Promise<{ error: string }> {
  const id = idSchema.safeParse(deliveryId)
  const parsed = z.array(receiptLineSchema).safeParse(lines)
  if (!id.success) return { error: feedbackMessage('gestion-datos-invalidos')! }
  if (!parsed.success) return { error: feedbackMessage(parsed.error.issues[0]?.path.includes('comment') ? 'gestion-nota-larga' : 'gestion-datos-invalidos')! }

  const file = formData.get('file')
  const upload = file instanceof File && file.size > 0 ? file : null
  if (!upload && parsed.data.length === 0) return { error: feedbackMessage('remito-requerido')! }
  if (upload && !isSignedNoteType(upload.type)) return { error: feedbackMessage('remito-tipo-invalido')! }
  if (upload && upload.size > SIGNED_NOTE_MAX_BYTES) return { error: feedbackMessage('remito-muy-grande')! }

  const { supabase } = await requireRole('admin')
  const { data: delivery } = await supabase.from('deliveries').select('request_id').eq('id', id.data).maybeSingle()
  if (!delivery) return { error: feedbackMessage('gestion-datos-invalidos')! }

  let path: string | null = null
  if (upload) {
    path = signedNotePath(id.data, upload.type as SignedNoteType)
    const { error: uploadError } = await supabase.storage.from(SIGNED_NOTES_BUCKET).upload(path, upload, { contentType: upload.type, upsert: false })
    if (uploadError) return { error: feedbackMessage('remito-subida-error')! }
  }

  const { data: confirmed, error } = await supabase.rpc('confirm_receipt_with_signed_note', { target_delivery_id: id.data, signed_note_path: path, receipt_lines: parsed.data.map((line) => ({ ...line, comment: line.comment || null })) })
  if (error) {
    // El archivo no quedó registrado: se borra para no dejarlo huérfano (la política solo permite eso).
    if (path) await supabase.storage.from(SIGNED_NOTES_BUCKET).remove([path])
    return { error: feedbackMessage(managementErrorCode(error, 'gestion-error'))! }
  }

  const requestId = delivery.request_id as string
  revalidateRequest(requestId)
  revalidatePath(`/recepciones/${id.data}`)
  redirectAfterAction(withFeedback(`/entregas/${id.data}`, 'success', (confirmed as number) > 0 ? 'recepcion-confirmada-remito' : 'remito-adjuntado'))
}

// Resolución de una diferencia de recepción desde el detalle de la solicitud (solo admin). El botón
// que envía el form define la resolución (name="resolution").
export async function resolveReceiptDifference(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  const receiptId = idSchema.safeParse(formData.get('receipt_id'))
  if (!requestId.success || !receiptId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const resolution = z.enum(receiptResolutions).safeParse(formData.get('resolution'))
  const note = noteSchema.safeParse(formData.get('note') ?? '')
  if (!resolution.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-motivo-requerido'))
  if (!note.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-nota-larga'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('resolve_receipt_difference', { target_receipt_id: receiptId.data, target_resolution: resolution.data, target_note: note.data || null })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirectAfterAction(withFeedback(page, 'success', 'diferencia-resuelta'))
}

// Requerimiento de compra desde el detalle (solo admin): registra o corrige el número que dio el
// sistema de compras; sin entregas, la solicitud pasa a "En compras" y con entregas parciales se
// muestra "En compras" junto a "Entrega parcial".
export async function setPurchaseRequirement(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const number = z.string().trim().min(1).max(PURCHASE_REQUIREMENT_MAX_LENGTH).safeParse(formData.get('requirement_number') ?? '')
  if (!number.success) redirectAfterAction(withFeedback(page, 'error', 'requerimiento-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('set_purchase_requirement', { target_request_id: requestId.data, requirement_number: number.data })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  redirectAfterAction(withFeedback(page, 'success', 'requerimiento-guardado'))
}

// Comentario de texto libre en el historial: el admin y Compras. La base valida el rol y que Compras
// solo comente solicitudes con requerimiento de compra (add_request_comment).
export async function addRequestComment(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const body = commentSchema.safeParse(formData.get('comment') ?? '')
  // Vuelve al ancla del formulario de comentarios: sin ella, la página se recarga desde arriba.
  const at = `${page}#comentar`
  if (!body.success) redirectAfterAction(withFeedback(at, 'error', 'comentario-invalido'))

  const { supabase, role } = await requireSession()
  if (role !== 'admin' && role !== 'purchasing') redirectAfterAction(withFeedback(at, 'error', 'sin-permiso'))
  const { error } = await supabase.rpc('add_request_comment', { target_request_id: requestId.data, comment_body: body.data })
  if (error) redirectAfterAction(withFeedback(at, 'error', managementErrorCode(error, 'gestion-error')))

  revalidatePath(page)
  redirectAfterAction(withFeedback(at, 'success', 'comentario-agregado'))
}

// /solicitudes/[id]/unificar: pasa lo pendiente de la solicitud origen a la destino y cierra el origen
// (merge_requests, supabase/migrations/202611180001_merge_requests.sql).
export async function mergeRequests(formData: FormData) {
  const sourceId = idSchema.safeParse(formData.get('source_id'))
  if (!sourceId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${sourceId.data}/unificar`

  const targetId = idSchema.safeParse(formData.get('target_id'))
  if (!targetId.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-datos-invalidos'))
  const reason = noteSchema.safeParse(formData.get('reason') ?? '')
  if (!reason.success) redirectAfterAction(withFeedback(page, 'error', 'gestion-nota-larga'))
  if (!reason.data) redirectAfterAction(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('merge_requests', { source_request_id: sourceId.data, target_request_id: targetId.data, merge_reason: reason.data })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(sourceId.data)
  revalidateRequest(targetId.data)
  redirectAfterAction(withFeedback(`/solicitudes/${targetId.data}`, 'success', 'solicitud-unificada'))
}

// Cancelación por el solicitante mientras no haya entregas activas (la base lo valida).
export async function cancelRequest(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirectAfterAction(withFeedback('/solicitudes', 'error', 'gestion-datos-invalidos'))
  const page = `/solicitudes/${requestId.data}`

  const { supabase, role } = await requireSession()
  if (role !== 'requester') redirectAfterAction(withFeedback(page, 'error', 'gestion-datos-invalidos'))
  const { error } = await supabase.rpc('cancel_request', { target_request_id: requestId.data })
  if (error) redirectAfterAction(withFeedback(page, 'error', managementErrorCode(error, 'gestion-error')))

  revalidateRequest(requestId.data)
  // La solicitud cancelada ya no tiene acciones: se vuelve al listado.
  redirectAfterAction(withFeedback('/solicitudes', 'success', 'solicitud-cancelada'))
}
