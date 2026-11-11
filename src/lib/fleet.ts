import { z } from 'zod'
import { argentinaDate } from './requests'

// Módulo Movilidad (docs/plans/diseno-movilidad.md). Validación compartida por formularios y server
// actions; la base repite las reglas (supabase/migrations/202610280001_fleet.sql) con los mismos límites.

// Rubro que da acceso al módulo (public.areas, kind 'fleet').
export const FLEET_AREA = 'fleet'

// Separa el rubro Movilidad de los rubros de insumos de un solicitante: `areas` son los de insumos
// (los que usan catálogo, solicitudes y filtros) y `fleetAccess` indica si tiene Movilidad.
export function splitAreas(rows: { area: string; kind: string }[]) {
  return {
    areas: rows.filter((row) => row.kind !== 'fleet').map((row) => row.area),
    fleetAccess: rows.some((row) => row.kind === 'fleet'),
  }
}

export const VEHICLE_TEXT_MAX = 80
export const INTERNAL_CODE_MAX = 30
export const FLEET_DESCRIPTION_MAX = 1000
export const WORKSHOP_MAX = 120
export const VEHICLE_YEAR_MIN = 1950

// Dominio: mayúsculas, sin espacios ni guiones. Formato viejo (ABC123) o Mercosur (AB123CD); la base
// acepta cualquier combinación de 6 o 7 letras y números.
export function normalizePlate(value: string) {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

export function isValidPlate(value: string) {
  return /^[A-Z0-9]{6,7}$/.test(normalizePlate(value))
}

type VehicleIdentity = { name: string; plate: string; internal_code: string | null }

// Como lo nombran: el identificador interno primero cuando existe.
export function vehicleLabel(vehicle: VehicleIdentity) {
  const base = `${vehicle.name} (${vehicle.plate})`
  return vehicle.internal_code ? `${vehicle.internal_code} · ${base}` : base
}

// Número de solicitud de servicio (vehicle_requests.request_number).
export function formatVehicleRequestNumber(value: number) {
  return `#SRV-${value}`
}

// Acepta "15", "#15", "SRV-15", "#SRV-15", "srv15".
export function parseVehicleRequestNumber(value: string) {
  const match = value.trim().match(/^#?\s*(?:srv-?\s*)?(\d{1,15})$/i)
  return match ? Number(match[1]) : null
}

// Estado calculado en la base (vehicle_request_status).
export const vehicleRequestStatuses = ['pending', 'purchase', 'completed', 'cancelled'] as const
export type VehicleRequestStatus = (typeof vehicleRequestStatuses)[number]

export const vehicleRequestStatusLabels: Record<VehicleRequestStatus, string> = {
  pending: 'Pendiente',
  purchase: 'En compras',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export const openVehicleRequestStatuses: VehicleRequestStatus[] = ['pending', 'purchase']

export const vehicleRecordKinds = ['maintenance', 'repair'] as const
export type VehicleRecordKind = (typeof vehicleRecordKinds)[number]

export const vehicleRecordKindLabels: Record<VehicleRecordKind, string> = {
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
}

// Fecha YYYY-MM-DD válida, desde 1950 y no posterior a hoy en Argentina.
export function isWorkDateAllowed(date: string, now: number = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false
  return date >= `${VEHICLE_YEAR_MIN}-01-01` && date <= argentinaDate(now)
}

const requiredText = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Máximo ${max} caracteres`)

export const vehicleSchema = z.object({
  name: requiredText(VEHICLE_TEXT_MAX, 'El nombre es obligatorio'),
  brand: requiredText(VEHICLE_TEXT_MAX, 'La marca es obligatoria'),
  model: requiredText(VEHICLE_TEXT_MAX, 'El modelo es obligatorio'),
  year: z.number({ error: 'Ingresá el año' }).int('Ingresá el año')
    .min(VEHICLE_YEAR_MIN, `El año tiene que ser ${VEHICLE_YEAR_MIN} o posterior`)
    .refine((year) => year <= new Date().getFullYear() + 1, 'El año no puede ser posterior al próximo'),
  plate: z.string().transform(normalizePlate).refine(isValidPlate, 'Ingresá un dominio válido (ej. AB123CD o ABC123)'),
  // Opcional: vacío o null queda en null (acepta su propia salida, que la server action vuelve a validar).
  internal_code: z.string().trim().max(INTERNAL_CODE_MAX, `Máximo ${INTERNAL_CODE_MAX} caracteres`).nullable().transform((value) => value || null),
})

const workFields = {
  description: requiredText(FLEET_DESCRIPTION_MAX, 'Contá qué se hizo'),
  performed_on: z.string().refine((date) => isWorkDateAllowed(date), 'Ingresá una fecha que no sea posterior a hoy'),
  workshop: requiredText(WORKSHOP_MAX, 'Indicá dónde se hizo'),
}

export const vehicleRecordSchema = z.object({ kind: z.enum(vehicleRecordKinds, { error: 'Elegí el tipo' }), ...workFields })

// Cierre de una solicitud: siempre es una reparación.
export const completeVehicleRequestSchema = z.object(workFields)

export const vehicleRequestSchema = z.object({
  vehicle_id: z.string().uuid('Elegí el vehículo'),
  description: requiredText(FLEET_DESCRIPTION_MAX, 'Describí el problema'),
})

export type VehicleInput = z.input<typeof vehicleSchema>
export type VehicleValues = z.output<typeof vehicleSchema>
export type VehicleRecordValues = z.infer<typeof vehicleRecordSchema>
export type CompleteVehicleRequestValues = z.infer<typeof completeVehicleRequestSchema>
export type VehicleRequestValues = z.infer<typeof vehicleRequestSchema>
