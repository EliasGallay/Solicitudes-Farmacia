import { z } from 'zod'

// Gestión de personal (docs/plans/diseno-gestion-personal.md). Validación compartida por formularios y
// server actions; la base repite las reglas (supabase/migrations/202611260001_staff.sql) con los mismos
// límites. Los códigos que devuelve validateLeaveInput son los de la base (rpcErrorCodes).

export const NAME_MAX = 80
export const SHORT_TEXT_MAX = 120
export const PHONE_MAX = 30
export const COMMENT_MAX = 500
export const LEAVE_DAYS_MAX = 366

export const LEAVE_KINDS = ['vacation', 'hours_permit', 'other'] as const
export type LeaveKind = (typeof LEAVE_KINDS)[number]

export const leaveKindLabels: Record<LeaveKind, string> = {
  vacation: 'Vacaciones',
  hours_permit: 'Permiso por horas',
  other: 'Otra licencia',
}

export const PERMIT_HOURS = [1.5, 3] as const

import { normalizeName } from './staff-import'

export { normalizeName }

type LeaveInput = {
  kind: string
  startsOn: string
  endsOn?: string
  days?: number | null
  hours?: number | null
  note?: string | null
}

export type LeaveValidation = { ok: true } | { ok: false; code: string }

// Reglas de forma de una licencia. Los días descontados no se recalculan con el rango: pueden ser
// menos o más que los días corridos (fines de semana, feriados). El solapamiento lo valida la base.
export function validateLeaveInput(input: LeaveInput): LeaveValidation {
  if (!(LEAVE_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, code: 'staff_invalid_kind' }
  }

  if (input.kind === 'hours_permit') {
    if (input.hours == null || !(PERMIT_HOURS as readonly number[]).includes(input.hours)) {
      return { ok: false, code: 'staff_invalid_hours' }
    }
    if (input.days != null) return { ok: false, code: 'staff_invalid_days' }
    if (input.endsOn != null && input.endsOn !== input.startsOn) {
      return { ok: false, code: 'staff_invalid_range' }
    }
    return { ok: true }
  }

  if (input.hours != null) return { ok: false, code: 'staff_invalid_hours' }
  if (input.days == null || !Number.isInteger(input.days) || input.days < 1 || input.days > LEAVE_DAYS_MAX) {
    return { ok: false, code: 'staff_invalid_days' }
  }
  const endsOn = input.endsOn ?? input.startsOn
  // Fechas ISO (AAAA-MM-DD): la comparación de texto ordena igual que las fechas.
  if (endsOn < input.startsOn) return { ok: false, code: 'staff_invalid_range' }

  if (input.kind === 'other') {
    const note = (input.note ?? '').trim()
    if (!note) return { ok: false, code: 'staff_note_required' }
    if (note.length > COMMENT_MAX) return { ok: false, code: 'staff_invalid_details' }
  }
  return { ok: true }
}

// Mayúscula inicial en cada palabra y después de guion: «GALLAY ELÍAS» → «Gallay Elías».
export function formatPersonName(value: string) {
  return normalizeName(value)
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
}

// dd/mm/aaaa a partir de una fecha ISO (aaaa-mm-dd). Sin conversión de zona: es solo texto.
export function formatDate(iso: string) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export type StatusTone = 'working' | 'leave'
export type CurrentStatus = { label: string; tone: StatusTone }

type StatusLeave = { kind: LeaveKind; startsOn: string; endsOn: string; hours: number | null }

// Estado de hoy de una persona a partir de sus licencias activas (sin anuladas).
export function currentStatus(leaves: StatusLeave[], today: string): CurrentStatus {
  const active = leaves.find((leave) => leave.startsOn <= today && leave.endsOn >= today)
  if (!active) return { label: 'Trabajando', tone: 'working' }
  if (active.kind === 'hours_permit') {
    return { label: `Permiso ${String(active.hours).replace('.', ',')} hs`, tone: 'leave' }
  }
  return { label: `${leaveKindLabels[active.kind]} hasta ${formatDate(active.endsOn)}`, tone: 'leave' }
}

const requiredName = (message: string) =>
  z.string({ error: message }).transform(formatPersonName).pipe(z.string().min(1, message).max(NAME_MAX, `Máximo ${NAME_MAX} caracteres`))

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`).nullish().transform((value) => value || null)

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida').or(z.literal('')).nullish()
  .transform((value) => value || null)

// Nombre y apellido obligatorios. El resto es opcional: se puede cargar solo el nombre y completar
// la ficha después.
export const staffMemberSchema = z.object({
  first_name: requiredName('Ingresá el nombre'),
  last_name: requiredName('Ingresá el apellido'),
  profession: optionalText(SHORT_TEXT_MAX),
  matricula: optionalText(SHORT_TEXT_MAX),
  dni: z.string().trim().regex(/^(\d{7,9})?$/, 'El DNI tiene entre 7 y 9 números').nullish().transform((value) => value || null),
  phone: optionalText(PHONE_MAX),
  address: optionalText(SHORT_TEXT_MAX),
  email: z.string().trim().email('Ingresá un email válido').max(SHORT_TEXT_MAX).or(z.literal('')).nullish().transform((value) => value || null),
  birth_date: isoDate,
  hire_date: isoDate,
  comment: optionalText(COMMENT_MAX),
  health_center_ids: z.array(z.string().uuid()).default([]),
})

// Validación de la forma de la licencia, con los mismos códigos que validateLeaveInput.
export const staffLeaveSchema = z
  .object({
    staff_member_id: z.string().uuid('Elegí la persona'),
    kind: z.enum(LEAVE_KINDS, { error: 'Elegí el tipo de licencia' }),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá la fecha'),
    ends_on: z.string().nullish().optional(),
    days: z.number().int().nullish().optional(),
    hours: z.number().nullish().optional(),
    note: z.string().nullish().optional(),
    comment: optionalText(COMMENT_MAX),
  })
  .superRefine((value, ctx) => {
    const result = validateLeaveInput({
      kind: value.kind,
      startsOn: value.starts_on,
      endsOn: value.ends_on ?? undefined,
      days: value.days ?? null,
      hours: value.hours ?? null,
      note: value.note ?? null,
    })
    if (!result.ok) ctx.addIssue({ code: 'custom', message: result.code, path: [] })
  })

// DNI con puntos de a tres: 30111222 → 30.111.222.
export function formatDni(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Años cumplidos entre una fecha ISO (p. ej. ingreso) y hoy.
export function yearsSince(startIso: string, todayIso: string) {
  const [sy, sm, sd] = startIso.split('-').map(Number)
  const [ty, tm, td] = todayIso.split('-').map(Number)
  let years = ty - sy
  if (tm < sm || (tm === sm && td < sd)) years -= 1
  return years
}

// Días corridos de a hasta b (negativo si b es anterior).
export function daysBetween(fromIso: string, toIso: string) {
  const utc = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000)
}

export type StaffMemberValues = z.output<typeof staffMemberSchema>
export type StaffLeaveValues = z.output<typeof staffLeaveSchema>
