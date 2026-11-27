'use server'

import { revalidatePath } from 'next/cache'
import { redirectAfterAction } from '@/lib/redirect'
import { z } from 'zod'
import { feedbackMessage, withFeedback, type FeedbackCode } from '../lib/feedback'
import { managementErrorCode, NOTE_MAX_LENGTH } from '../lib/request-management'
import { requireRole } from '../lib/session'
import { staffIncidentEventSchema, staffIncidentSchema, staffLeaveSchema, staffMemberSchema, type StaffLeaveValues, type StaffMemberValues } from '../lib/staff'

// Gestión de personal (docs/plans/plan-gestion-personal.md). Solo admin. Cada acción llama a una RPC
// de supabase/migrations/202611260001_staff.sql, que vuelve a validar permisos y datos dentro de una
// transacción. Los códigos cortos de la base se traducen con managementErrorCode.

const idSchema = z.string().uuid()
const reasonSchema = z.string().trim().min(1).max(NOTE_MAX_LENGTH)

const STAFF_HOME = '/personal'
const staffPage = (id: string) => `/personal/${id}`

function staffErrorCode(error: { message?: string } | null): FeedbackCode {
  return managementErrorCode(error, 'personal-error')
}

function revalidateStaff() {
  revalidatePath(STAFF_HOME, 'layout')
}

// Los datos opcionales viajan como jsonb a la RPC con los mismos nombres de la tabla.
function detailsOf(values: StaffMemberValues) {
  return {
    profession: values.profession,
    matricula: values.matricula,
    dni: values.dni,
    phone: values.phone,
    address: values.address,
    email: values.email,
    birth_date: values.birth_date,
    hire_date: values.hire_date,
    comment: values.comment,
  }
}

// Formularios cliente de alta y edición: devuelven el error para no perder lo cargado.
export async function createStaffMember(values: unknown): Promise<{ error: string }> {
  const parsed = staffMemberSchema.safeParse(values)
  if (!parsed.success) return { error: feedbackMessage('personal-datos-invalidos')! }

  const { supabase } = await requireRole('admin')
  const { data, error } = await supabase.rpc('staff_create_member', {
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    p_details: detailsOf(parsed.data),
    p_health_center_ids: parsed.data.health_center_ids,
  })
  if (error || !data) return { error: feedbackMessage(staffErrorCode(error))! }

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(data as string), 'success', 'personal-creada'))
}

export async function updateStaffMember(staffMemberId: string, values: unknown): Promise<{ error: string }> {
  const id = idSchema.safeParse(staffMemberId)
  const parsed = staffMemberSchema.safeParse(values)
  if (!id.success || !parsed.success) return { error: feedbackMessage('personal-datos-invalidos')! }

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_update_member', {
    p_id: id.data,
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    p_details: detailsOf(parsed.data),
    p_health_center_ids: parsed.data.health_center_ids,
  })
  if (error) return { error: feedbackMessage(staffErrorCode(error))! }

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(id.data), 'success', 'personal-actualizada'))
}

// La licencia se valida por forma en staffLeaveSchema y por reglas y solapamiento en la RPC.
export async function registerStaffLeave(values: unknown): Promise<{ error: string }> {
  const parsed = staffLeaveSchema.safeParse(values)
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message
    return { error: feedbackMessage(code && code.startsWith('staff_') ? managementErrorCode({ message: code }, 'personal-datos-invalidos') : 'personal-datos-invalidos')! }
  }
  const input: StaffLeaveValues = parsed.data

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_register_leave', {
    p_staff_member_id: input.staff_member_id,
    p_kind: input.kind,
    p_starts_on: input.starts_on,
    p_ends_on: input.kind === 'hours_permit' ? input.starts_on : input.ends_on ?? null,
    p_days: input.kind === 'hours_permit' ? null : input.days ?? null,
    p_hours: input.kind === 'hours_permit' ? input.hours ?? null : null,
    p_note: input.kind === 'other' ? input.note ?? null : null,
    p_comment: input.comment,
  })
  if (error) return { error: feedbackMessage(staffErrorCode(error))! }

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(input.staff_member_id), 'success', 'personal-licencia-registrada'))
}

// Baja o reactivación desde el menú de la tabla. Vuelve al listado con el resultado.
export async function setStaffMemberActive(formData: FormData) {
  const memberId = idSchema.safeParse(formData.get('staff_member_id'))
  if (!memberId.success) redirectAfterAction(withFeedback(STAFF_HOME, 'error', 'personal-no-encontrado'))
  const active = formData.get('active') === 'true'

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_set_member_active', { p_id: memberId.data, p_active: active })
  if (error) redirectAfterAction(withFeedback(STAFF_HOME, 'error', staffErrorCode(error)))

  revalidateStaff()
  redirectAfterAction(withFeedback(STAFF_HOME, 'success', active ? 'personal-reactivada' : 'personal-desactivada'))
}

// Anulación desde la ficha: el formulario envía la persona para volver a su historial.
export async function voidStaffLeave(formData: FormData) {
  const leaveId = idSchema.safeParse(formData.get('leave_id'))
  const memberId = idSchema.safeParse(formData.get('staff_member_id'))
  if (!leaveId.success || !memberId.success) redirectAfterAction(withFeedback(STAFF_HOME, 'error', 'personal-no-encontrado'))

  const reason = reasonSchema.safeParse(formData.get('reason'))
  if (!reason.success) redirectAfterAction(withFeedback(staffPage(memberId.data), 'error', 'personal-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_void_leave', { p_id: leaveId.data, p_reason: reason.data })
  if (error) redirectAfterAction(withFeedback(staffPage(memberId.data), 'error', staffErrorCode(error)))

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(memberId.data), 'success', 'personal-licencia-anulada'))
}

// Novedad del trabajador. Se valida por forma en staffIncidentSchema y por fechas en la RPC.
export async function registerStaffIncident(values: unknown): Promise<{ error: string }> {
  const parsed = staffIncidentSchema.safeParse(values)
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message
    return { error: feedbackMessage(code && code.startsWith('staff_') ? managementErrorCode({ message: code }, 'personal-datos-invalidos') : 'personal-datos-invalidos')! }
  }
  const input = parsed.data

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_register_incident', {
    p_staff_member_id: input.staff_member_id,
    p_category: input.category,
    p_occurred_on: input.occurred_on,
    p_ends_on: input.ends_on,
    p_description: input.description,
  })
  if (error) return { error: feedbackMessage(staffErrorCode(error))! }

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(input.staff_member_id), 'success', 'personal-novedad-registrada'))
}

// Seguimiento de una novedad: agrega un evento con fecha. Vuelve a la ficha con el resultado.
export async function addStaffIncidentEvent(values: unknown): Promise<{ error: string }> {
  const parsed = staffIncidentEventSchema.safeParse(values)
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message
    return { error: feedbackMessage(code && code.startsWith('staff_') ? managementErrorCode({ message: code }, 'personal-datos-invalidos') : 'personal-datos-invalidos')! }
  }
  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_add_incident_event', {
    p_incident_id: parsed.data.incident_id,
    p_event_on: parsed.data.event_on,
    p_note: parsed.data.note,
  })
  if (error) return { error: feedbackMessage(staffErrorCode(error))! }

  revalidateStaff()
  return { error: '' }
}

// Anulación de una novedad desde la ficha. Mismo criterio que las licencias: motivo obligatorio.
export async function voidStaffIncident(formData: FormData) {
  const incidentId = idSchema.safeParse(formData.get('incident_id'))
  const memberId = idSchema.safeParse(formData.get('staff_member_id'))
  if (!incidentId.success || !memberId.success) redirectAfterAction(withFeedback(STAFF_HOME, 'error', 'personal-no-encontrado'))

  const reason = reasonSchema.safeParse(formData.get('reason'))
  if (!reason.success) redirectAfterAction(withFeedback(staffPage(memberId.data), 'error', 'personal-motivo-requerido'))

  const { supabase } = await requireRole('admin')
  const { error } = await supabase.rpc('staff_void_incident', { p_id: incidentId.data, p_reason: reason.data })
  if (error) redirectAfterAction(withFeedback(staffPage(memberId.data), 'error', staffErrorCode(error)))

  revalidateStaff()
  redirectAfterAction(withFeedback(staffPage(memberId.data), 'success', 'personal-novedad-anulada'))
}
