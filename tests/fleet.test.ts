import { describe, expect, it } from 'vitest'
import { adminNavigation, requesterNavigation } from '../src/lib/navigation'
import { formatVehicleRequestNumber, isValidPlate, isWorkDateAllowed, normalizePlate, parseVehicleRequestNumber, splitAreas, vehicleLabel, vehicleRecordSchema, vehicleSchema } from '../src/lib/fleet'

const vehicle = { name: 'Ambulancia', brand: 'Mercedes-Benz', model: 'Sprinter', year: 2019, plate: 'AB123CD', internal_code: 'Blanco 01' }

describe('dominio', () => {
  it.each([['ab 123-cd', 'AB123CD'], [' abc-123 ', 'ABC123']])('normaliza %s', (input, expected) => expect(normalizePlate(input)).toBe(expected))
  it.each(['ABC123', 'AB123CD', 'ab 123 cd'])('acepta %s', (value) => expect(isValidPlate(value)).toBe(true))
  it.each(['', 'AB12', 'ABCD1234', 'AB-12', 'AB12*CD'])('rechaza %s', (value) => expect(isValidPlate(value)).toBe(false))
})

describe('vehículo', () => {
  it('antepone el identificador interno', () => expect(vehicleLabel({ name: 'Ambulancia', plate: 'AB123CD', internal_code: 'Blanco 01' })).toBe('Blanco 01 · Ambulancia (AB123CD)'))
  it('sin identificador', () => expect(vehicleLabel({ name: 'Ambulancia', plate: 'AB123CD', internal_code: null })).toBe('Ambulancia (AB123CD)'))
  it('normaliza el dominio y deja el identificador vacío en null', () => {
    const parsed = vehicleSchema.parse({ ...vehicle, plate: 'ab 123-cd', internal_code: '  ' })
    expect(parsed.plate).toBe('AB123CD')
    expect(parsed.internal_code).toBeNull()
  })
  it('acepta su propia salida (el formulario manda valores ya normalizados)', () => expect(vehicleSchema.safeParse(vehicleSchema.parse({ ...vehicle, internal_code: '' })).success).toBe(true))
  it('rechaza año anterior a 1950', () => expect(vehicleSchema.safeParse({ ...vehicle, year: 1949 }).success).toBe(false))
  it('rechaza año posterior al siguiente', () => expect(vehicleSchema.safeParse({ ...vehicle, year: new Date().getFullYear() + 2 }).success).toBe(false))
  it('rechaza dominio inválido', () => expect(vehicleSchema.safeParse({ ...vehicle, plate: 'AB12' }).success).toBe(false))
  it('rechaza identificador de más de 30 caracteres', () => expect(vehicleSchema.safeParse({ ...vehicle, internal_code: 'x'.repeat(31) }).success).toBe(false))
})

describe('número de solicitud de servicio', () => {
  it('formatea con prefijo SRV', () => expect(formatVehicleRequestNumber(15)).toBe('#SRV-15'))
  it.each(['15', '#SRV-15', 'srv15', ' #srv-15 '])('interpreta %s', (value) => expect(parseVehicleRequestNumber(value)).toBe(15))
  it.each(['', 'SOL-15', 'SRV-', '1.5'])('rechaza %s', (value) => expect(parseVehicleRequestNumber(value)).toBeNull())
})

describe('fecha de trabajo', () => {
  const at2200 = new Date('2026-10-29T01:00:00Z').getTime() // 22:00 del 28/10 en Argentina
  it('hoy en Argentina es válido', () => expect(isWorkDateAllowed('2026-10-28', at2200)).toBe(true))
  it('mañana no', () => expect(isWorkDateAllowed('2026-10-29', at2200)).toBe(false))
  it('rechaza fechas mal formadas', () => expect(isWorkDateAllowed('28/10/2026', at2200)).toBe(false))
})

describe('registro del historial', () => {
  const record = { kind: 'maintenance', description: 'Cambio de aceite', performed_on: '2026-10-01', workshop: 'Lubricentro' }
  it('acepta un mantenimiento', () => expect(vehicleRecordSchema.safeParse(record).success).toBe(true))
  it('exige taller', () => expect(vehicleRecordSchema.safeParse({ ...record, workshop: '  ' }).success).toBe(false))
  it('rechaza tipo desconocido', () => expect(vehicleRecordSchema.safeParse({ ...record, kind: 'otro' }).success).toBe(false))
  it('rechaza descripción de más de 1000 caracteres', () => expect(vehicleRecordSchema.safeParse({ ...record, description: 'x'.repeat(1001) }).success).toBe(false))
})

describe('rubros de la sesión', () => {
  it('separa Movilidad de los rubros de insumos', () => expect(splitAreas([{ area: 'pharmacy', kind: 'supplies' }, { area: 'fleet', kind: 'fleet' }])).toEqual({ areas: ['pharmacy'], fleetAccess: true }))
  it('sin Movilidad', () => expect(splitAreas([{ area: 'pharmacy', kind: 'supplies' }])).toEqual({ areas: ['pharmacy'], fleetAccess: false }))
  it('solo Movilidad', () => expect(splitAreas([{ area: 'fleet', kind: 'fleet' }])).toEqual({ areas: [], fleetAccess: true }))
})

describe('menú del solicitante', () => {
  const hrefs = (access: { supplies: boolean; fleet: boolean }) => requesterNavigation(access).map((item) => item.href)
  it('solo Movilidad no ve insumos', () => expect(hrefs({ supplies: false, fleet: true })).toEqual(['/', '/movilidad']))
  it('solo insumos no ve Movilidad', () => expect(hrefs({ supplies: true, fleet: false })).not.toContain('/movilidad'))
  it('solo insumos conserva el menú actual', () => expect(hrefs({ supplies: true, fleet: false })).toEqual(['/', '/solicitudes', '/solicitudes?estado=por_confirmar', '/solicitudes/nueva', '/catalogo']))
  it('ambos ven todo', () => expect(hrefs({ supplies: true, fleet: true })).toContain('/movilidad'))
})

describe('menú del admin', () => {
  it('incluye Movilidad después de Entregas', () => {
    const hrefs = adminNavigation.map((item) => item.href)
    expect(hrefs.indexOf('/movilidad')).toBe(hrefs.indexOf('/entregas') + 1)
  })
})
