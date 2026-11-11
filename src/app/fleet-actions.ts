'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { feedbackMessage, withFeedback, type FeedbackCode } from '../lib/feedback'
import { evidenceName, evidencePath, evidenceTypeSchema, FLEET_EVIDENCE_BUCKET, FLEET_EVIDENCE_MAX_BYTES, isEvidenceContentType, type EvidenceTarget, type EvidenceTypeInput } from '../lib/fleet-evidence'
import { completeVehicleRequestSchema, vehicleRecordSchema, vehicleRequestSchema, vehicleSchema, type CompleteVehicleRequestValues, type VehicleInput, type VehicleRecordValues, type VehicleRequestValues } from '../lib/fleet'
import { managementErrorCode, NOTE_MAX_LENGTH, PURCHASE_REQUIREMENT_MAX_LENGTH } from '../lib/request-management'
import { requireFleetAccess, requireRole } from '../lib/session'

// Módulo Movilidad (docs/plans/plan-movilidad.md). El ABM de vehículos escribe la tabla (RLS: solo
// admin); el resto llama a las RPCs de supabase/migrations/202610280001_fleet.sql, que vuelven a
// validar permisos y datos dentro de una transacción.

const idSchema = z.string().uuid()
const reasonSchema = z.string().trim().min(1).max(NOTE_MAX_LENGTH)

const FLEET_HOME = '/movilidad'
const vehiclePage = (id: string) => `/movilidad/vehiculos/${id}`
const requestPage = (id: string) => `/movilidad/solicitudes/${id}`

// 23505: dominio o identificador interno repetido. Los demás, códigos cortos de las RPCs y triggers.
function fleetErrorCode(error: { code?: string; message?: string } | null): FeedbackCode {
  return error?.code === '23505' ? 'vehiculo-duplicado' : managementErrorCode(error, 'movilidad-error')
}

// Listados, fichas, historial y solicitudes cuelgan de /movilidad.
function revalidateFleet() {
  revalidatePath(FLEET_HOME, 'layout')
}

// Formularios cliente de alta y edición (solo admin): devuelven el error para no perder lo cargado.
export async function createVehicle(values: VehicleInput): Promise<{ error: string }> {
  const parsed = vehicleSchema.safeParse(values)
  if (!parsed.success) return { error: feedbackMessage('vehiculo-invalido')! }

  const { supabase } = await requireRole('admin')
  const { data, error } = await supabase.from('vehicles').insert(parsed.data).select('id').single()
  if (error || !data) return { error: feedbackMessage(fleetErrorCode(error))! }

  revalidateFleet()
  redirect(withFeedback(vehiclePage(data.id as string), 'success', 'vehiculo-creado'))
}

export async function updateVehicle(vehicleId: string, values: VehicleInput): Promise<{ error: string }> {
  const id = idSchema.safeParse(vehicleId)
  const parsed = vehicleSchema.safeParse(values)
  if (!id.success || !parsed.success) return { error: feedbackMessage('vehiculo-invalido')! }

  const { supabase } = await requireRole('admin')
  const { data, error } = await supabase.from('vehicles').update(parsed.data).eq('id', id.data).select('id').maybeSingle()
  if (error || !data) return { error: feedbackMessage(fleetErrorCode(error))! }

  revalidateFleet()
  redirect(withFeedback(vehiclePage(id.data), 'success', 'vehiculo-actualizado'))
}

// Activa o desactiva (`active` = estado nuevo). La base impide desactivar con solicitudes abiertas.
export async function toggleVehicle(formData: FormData) {
  const id = idSchema.safeParse(formData.get('vehicle_id'))
  if (!id.success) redirect(withFeedback(FLEET_HOME, 'error', 'vehiculo-invalido'))
  const active = formData.get('active') === 'true'

  const { supabase } = await requireRole('admin')
  const { data, error } = await supabase.from('vehicles').update({ active }).eq('id', id.data).select('id').maybeSingle()
  if (error || !data) redirect(withFeedback(vehiclePage(id.data), 'error', fleetErrorCode(error)))

  revalidateFleet()
  redirect(withFeedback(vehiclePage(id.data), 'success', active ? 'vehiculo-activado' : 'vehiculo-desactivado'))
}

// Carga directa en el historial (mantenimiento de rutina o reparación sin solicitud).
export async function addVehicleRecord(vehicleId: string, values: VehicleRecordValues): Promise<{ error: string }> {
  const id = idSchema.safeParse(vehicleId)
  const parsed = vehicleRecordSchema.safeParse(values)
  if (!id.success || !parsed.success) return { error: feedbackMessage('registro-invalido')! }

  const { supabase } = await requireFleetAccess()
  const { error } = await supabase.rpc('add_vehicle_record', {
    target_vehicle_id: id.data,
    record_kind: parsed.data.kind,
    record_description: parsed.data.description,
    record_performed_on: parsed.data.performed_on,
    record_workshop: parsed.data.workshop,
  })
  if (error) return { error: feedbackMessage(fleetErrorCode(error))! }

  revalidateFleet()
  redirect(withFeedback(vehiclePage(id.data), 'success', 'registro-creado'))
}

// Anulación de un registro del historial con motivo (solo admin). Si había cerrado una solicitud,
// la solicitud vuelve a estar abierta.
export async function voidVehicleRecord(formData: FormData) {
  const vehicleId = idSchema.safeParse(formData.get('vehicle_id'))
  if (!vehicleId.success) redirect(withFeedback(FLEET_HOME, 'error', 'vehiculo-invalido'))
  const page = vehiclePage(vehicleId.data)
  const recordId = idSchema.safeParse(formData.get('record_id'))
  if (!recordId.success) redirect(withFeedback(page, 'error', 'registro-invalido'))
  const reason = reasonSchema.safeParse(formData.get('reason') ?? '')
  if (!reason.success) redirect(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('void_vehicle_record', { target_record_id: recordId.data, reason: reason.data })
  if (error) redirect(withFeedback(page, 'error', fleetErrorCode(error)))

  revalidateFleet()
  redirect(withFeedback(page, 'success', 'registro-anulado'))
}

// Nueva solicitud de servicio (formulario cliente).
export async function createVehicleRequest(values: VehicleRequestValues): Promise<{ error: string }> {
  const parsed = vehicleRequestSchema.safeParse(values)
  if (!parsed.success) return { error: feedbackMessage('descripcion-invalida')! }

  const { supabase } = await requireFleetAccess()
  const { data, error } = await supabase.rpc('create_vehicle_request', { target_vehicle_id: parsed.data.vehicle_id, request_description: parsed.data.description })
  if (error || !data) return { error: feedbackMessage(fleetErrorCode(error))! }

  revalidateFleet()
  redirect(withFeedback(requestPage(data as string), 'success', 'solicitud-servicio-creada'))
}

// Requerimiento de compra desde el detalle (solo admin): la solicitud pasa a "En compras".
export async function setVehiclePurchaseRequirement(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirect(withFeedback(`${FLEET_HOME}/solicitudes`, 'error', 'gestion-datos-invalidos'))
  const page = requestPage(requestId.data)
  const number = z.string().trim().min(1).max(PURCHASE_REQUIREMENT_MAX_LENGTH).safeParse(formData.get('requirement_number') ?? '')
  if (!number.success) redirect(withFeedback(page, 'error', 'requerimiento-invalido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('set_vehicle_purchase_requirement', { target_request_id: requestId.data, requirement_number: number.data })
  if (error) redirect(withFeedback(page, 'error', fleetErrorCode(error)))

  revalidateFleet()
  redirect(withFeedback(page, 'success', 'requerimiento-guardado'))
}

// Cierre con lo que se reparó, cuándo y dónde (formulario cliente): queda en el historial del vehículo.
export async function completeVehicleRequest(requestId: string, values: CompleteVehicleRequestValues): Promise<{ error: string }> {
  const id = idSchema.safeParse(requestId)
  const parsed = completeVehicleRequestSchema.safeParse(values)
  if (!id.success || !parsed.success) return { error: feedbackMessage('registro-invalido')! }

  const { supabase } = await requireFleetAccess()
  const { error } = await supabase.rpc('complete_vehicle_request', {
    target_request_id: id.data,
    record_description: parsed.data.description,
    record_performed_on: parsed.data.performed_on,
    record_workshop: parsed.data.workshop,
  })
  if (error) return { error: feedbackMessage(fleetErrorCode(error))! }

  revalidateFleet()
  redirect(withFeedback(requestPage(id.data), 'success', 'solicitud-servicio-completada'))
}

export async function cancelVehicleRequest(formData: FormData) {
  const requestId = idSchema.safeParse(formData.get('request_id'))
  if (!requestId.success) redirect(withFeedback(`${FLEET_HOME}/solicitudes`, 'error', 'gestion-datos-invalidos'))
  const page = requestPage(requestId.data)
  const reason = reasonSchema.safeParse(formData.get('reason') ?? '')
  if (!reason.success) redirect(withFeedback(page, 'error', 'gestion-motivo-requerido'))

  const { supabase } = await requireFleetAccess()
  const { error } = await supabase.rpc('cancel_vehicle_request', { target_request_id: requestId.data, reason: reason.data })
  if (error) redirect(withFeedback(page, 'error', fleetErrorCode(error)))

  revalidateFleet()
  redirect(withFeedback(page, 'success', 'solicitud-servicio-cancelada'))
}

// Archivo de evidencia (formulario cliente): se manda de a uno, así que cada llamada sube un archivo y lo
// registra con add_fleet_evidence. Devuelve el error para mostrarlo junto al nombre; no redirige (el
// formulario refresca la pantalla al terminar). Si el registro falla, el archivo subido se elimina.
export async function uploadFleetEvidence(target: EvidenceTarget, values: EvidenceTypeInput, formData: FormData): Promise<{ error: string | null }> {
  const targetId = idSchema.safeParse(target?.id)
  const kind = z.enum(['request', 'record']).safeParse(target?.kind)
  const type = evidenceTypeSchema.safeParse(values)
  if (!targetId.success || !kind.success) return { error: feedbackMessage('archivo-invalido')! }
  if (!type.success) return { error: feedbackMessage('tipo-documento-invalido')! }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: feedbackMessage('archivo-invalido')! }
  if (!isEvidenceContentType(file.type)) return { error: feedbackMessage('archivo-tipo-invalido')! }
  if (file.size > FLEET_EVIDENCE_MAX_BYTES) return { error: feedbackMessage('archivo-muy-grande')! }

  const { supabase } = await requireFleetAccess()
  const path = evidencePath({ kind: kind.data, id: targetId.data }, file.type)
  const { error: uploadError } = await supabase.storage.from(FLEET_EVIDENCE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) return { error: feedbackMessage('archivo-subida-error')! }

  const { error } = await supabase.rpc('add_fleet_evidence', {
    target_request_id: kind.data === 'request' ? targetId.data : null,
    target_record_id: kind.data === 'record' ? targetId.data : null,
    evidence_type: type.data.document_type,
    evidence_type_other: type.data.document_type_other,
    evidence_path: path,
    evidence_name: evidenceName(file.name),
  })
  if (error) {
    // No quedó registrado: se elimina para no dejarlo huérfano (la política solo permite eso).
    await supabase.storage.from(FLEET_EVIDENCE_BUCKET).remove([path])
    return { error: feedbackMessage(fleetErrorCode(error))! }
  }

  revalidateFleet()
  return { error: null }
}

// Borrado lógico de un archivo (quien lo subió o el admin; la base lo valida). `return_to`: pantalla
// desde la que se borró, siempre dentro de /movilidad.
export async function deleteFleetEvidence(formData: FormData) {
  const returnTo = z.string().max(200).startsWith('/movilidad/').catch(FLEET_HOME).parse(formData.get('return_to'))
  const evidenceId = idSchema.safeParse(formData.get('evidence_id'))
  if (!evidenceId.success) redirect(withFeedback(returnTo, 'error', 'archivo-invalido'))

  const { supabase } = await requireFleetAccess()
  const { error } = await supabase.rpc('delete_fleet_evidence', { target_evidence_id: evidenceId.data })
  if (error) redirect(withFeedback(returnTo, 'error', error.message === 'sin-permiso' ? 'sin-permiso-archivo' : fleetErrorCode(error)))

  revalidateFleet()
  redirect(withFeedback(returnTo, 'success', 'archivo-borrado'))
}
