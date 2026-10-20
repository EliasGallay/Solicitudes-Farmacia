import { describe, expect, it } from 'vitest'
import { formatBucket, formatHours, metricPeriodParamSchema, percent, relativeChange } from '../src/lib/admin-metrics'
import { axisLabelIndexes, niceScale } from '../src/lib/chart'

describe('metricPeriodParamSchema', () => {
  it('acepta los períodos ofrecidos', () => expect(metricPeriodParamSchema.parse('90')).toBe(90))
  it('vuelve a 30 días ante un valor desconocido o ausente', () => {
    expect(metricPeriodParamSchema.parse('45')).toBe(30)
    expect(metricPeriodParamSchema.parse(undefined)).toBe(30)
    expect(metricPeriodParamSchema.parse('abc')).toBe(30)
  })
})

describe('percent y relativeChange', () => {
  it('redondea el porcentaje y devuelve null sin total', () => {
    expect(percent(2, 3)).toBe(67)
    expect(percent(0, 0)).toBeNull()
  })
  it('compara contra el período anterior solo si hay base', () => {
    expect(relativeChange(15, 10)).toBe(50)
    expect(relativeChange(5, 10)).toBe(-50)
    expect(relativeChange(5, 0)).toBeNull()
  })
})

describe('formatHours', () => {
  it('usa horas por debajo de un día y días con un decimal después', () => {
    expect(formatHours(null)).toBe('—')
    expect(formatHours(0.4)).toBe('< 1 h')
    expect(formatHours(5.6)).toBe('6 h')
    expect(formatHours(24)).toBe('1 día')
    expect(formatHours(60)).toBe('2,5 días')
  })
})

describe('formatBucket', () => {
  it('nombra el día o la semana', () => {
    expect(formatBucket('2026-10-12', 'day')).toBe('12 oct')
    expect(formatBucket('2026-10-12', 'week')).toBe('Semana del 12 oct')
  })
})

describe('niceScale', () => {
  it('redondea el máximo a pasos de 1, 2 o 5', () => {
    expect(niceScale(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] })
    expect(niceScale(130)).toEqual({ max: 150, ticks: [0, 50, 100, 150] })
  })
  it('usa una escala mínima sin datos', () => expect(niceScale(0).max).toBe(4))
})

describe('axisLabelIndexes', () => {
  it('reparte las etiquetas incluyendo los extremos', () => {
    expect(axisLabelIndexes(3, 7)).toEqual([0, 1, 2])
    expect(axisLabelIndexes(30, 4)).toEqual([0, 10, 19, 29])
  })
})
