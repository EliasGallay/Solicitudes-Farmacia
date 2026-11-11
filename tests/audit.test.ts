import { describe, expect, it } from 'vitest'
import { auditActionLabel, auditEntityHref } from '../src/lib/audit'

describe('auditoría de Movilidad', () => {
  it('tiene etiqueta para la anulación de un registro', () => expect(auditActionLabel('vehicle_record.voided')).toBe('Registro de vehículo anulado'))
  it.each(['vehicle.created', 'vehicle.updated', 'vehicle.deactivated', 'vehicle.activated', 'vehicle_record.created', 'vehicle_request.created', 'vehicle_request.purchase_requirement', 'vehicle_request.completed', 'vehicle_request.cancelled'])('tiene etiqueta para %s', (action) => expect(auditActionLabel(action)).not.toBe(action))
  it('enlaza la ficha del vehículo', () => expect(auditEntityHref('vehicle', 'abc')).toBe('/movilidad/vehiculos/abc'))
  it('enlaza la solicitud de servicio', () => expect(auditEntityHref('vehicle_request', 'abc')).toBe('/movilidad/solicitudes/abc'))
})

describe('auditoría de archivos de Movilidad', () => {
  it('etiqueta el archivo adjuntado', () => expect(auditActionLabel('fleet_evidence.added')).toBe('Archivo adjuntado (Movilidad)'))
  it('etiqueta el archivo borrado', () => expect(auditActionLabel('fleet_evidence.deleted')).toBe('Archivo borrado (Movilidad)'))
})
