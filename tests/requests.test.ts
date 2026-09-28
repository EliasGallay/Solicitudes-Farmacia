import { describe, expect, it } from 'vitest'
import { argentinaDate, formatDeliveryNumber, formatRequestNumber, formatWait, parseDeliveryNumber, parseRequestNumber, shiftDate, summarizeItems, waitDays } from '../src/lib/requests'

describe('número de solicitud', () => {
  it('formatea con prefijo SOL', () => expect(formatRequestNumber(1024)).toBe('#SOL-1024'))
  it.each(['1024', '#1024', 'SOL-1024', '#SOL-1024', 'sol1024', ' #sol-1024 '])('interpreta %s', (value) => expect(parseRequestNumber(value)).toBe(1024))
  it.each(['', 'abc', 'SOL-', '10.5', '-3'])('rechaza %s', (value) => expect(parseRequestNumber(value)).toBeNull())
})

describe('número de remito', () => {
  it('formatea con prefijo REM', () => expect(formatDeliveryNumber(15)).toBe('#REM-15'))
  it.each(['15', '#15', 'REM-15', '#REM-15', 'rem15', ' #rem-15 '])('interpreta %s', (value) => expect(parseDeliveryNumber(value)).toBe(15))
  it.each(['', 'abc', 'REM-', 'SOL-15', '1.5'])('rechaza %s', (value) => expect(parseDeliveryNumber(value)).toBeNull())
})

describe('fechas en Argentina', () => {
  it('usa el día de Argentina (UTC-3)', () => expect(argentinaDate('2026-10-05T02:00:00Z')).toBe('2026-10-04'))
  it('suma y resta días', () => {
    expect(shiftDate('2026-10-30', 3)).toBe('2026-11-02')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('espera de una solicitud', () => {
  // 09:00 del 5/10 en Argentina.
  const now = new Date('2026-10-05T12:00:00Z').getTime()
  it('cuenta días calendario', () => expect(waitDays('2026-10-02T13:00:00Z', now)).toBe(3))
  it('es 0 el mismo día', () => expect(waitDays('2026-10-05T08:00:00Z', now)).toBe(0))
  it('ayer a la noche es 1 día', () => expect(waitDays('2026-10-05T02:00:00Z', now)).toBe(1))
  it('no da negativos', () => expect(waitDays('2026-10-06T08:00:00Z', now)).toBe(0))
  it.each([[0, 'Hoy'], [1, '1 día'], [4, '4 días']] as const)('formatea %i', (days, text) => expect(formatWait(days)).toBe(text))
})

describe('resumen de cantidades', () => {
  it('suma solicitado, entregado, cerrado y pendiente', () => {
    const summary = summarizeItems([
      { requested_quantity: 10, delivered_quantity: 4, closed_quantity: 2, pending_quantity: 4 },
      { requested_quantity: 5, delivered_quantity: 0, pending_quantity: 5 },
    ])
    expect(summary).toEqual({ products: 2, requested: 15, delivered: 4, closed: 2, pending: 9 })
  })
})
