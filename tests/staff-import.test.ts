import { describe, expect, it } from 'vitest'
import { findDuplicates, interpretLicense, splitPlanillaName } from '../src/lib/staff-import'

describe('splitPlanillaName', () => {
  it('toma el primer token como apellido y el segundo como nombre', () => {
    expect(splitPlanillaName('SOTO ANA')).toEqual({ lastName: 'SOTO', firstName: 'ANA', ambiguous: false })
  })

  it('respeta la coma como separador', () => {
    expect(splitPlanillaName('PEREZ,LAURA')).toEqual({ lastName: 'PEREZ', firstName: 'LAURA', ambiguous: false })
  })

  it('marca como ambiguo un nombre de tres partes', () => {
    expect(splitPlanillaName('NUNEZ JUAN PABLO').ambiguous).toBe(true)
  })
})

describe('interpretLicense', () => {
  it('interpreta un permiso de 3 hs con fecha', () => {
    expect(interpretLicense('27/11 3HS', 2026)).toEqual({ kind: 'hours_permit', startsOn: '2026-11-27', hours: 3 })
  })

  it('interpreta un permiso de 1,5 hs con coma decimal', () => {
    expect(interpretLicense('13/11 1,5HS', 2026)).toEqual({ kind: 'hours_permit', startsOn: '2026-11-13', hours: 1.5 })
  })

  it('no interpreta un rango sin mes (queda para revisión)', () => {
    expect(interpretLicense('29 AL 30 DIAS DE ESTUDIOS', 2026)).toEqual({ kind: 'unparsed', raw: '29 AL 30 DIAS DE ESTUDIOS' })
  })

  it('no interpreta una línea de reintegro (queda para revisión)', () => {
    expect(interpretLicense('18/01 REINEGRA 25/1', 2026)).toEqual({ kind: 'unparsed', raw: '18/01 REINEGRA 25/1' })
  })
})

describe('findDuplicates', () => {
  it('agrupa las personas repetidas por nombre normalizado', () => {
    const groups = findDuplicates([
      { lastName: 'PEREZ', firstName: 'LAURA' },
      { lastName: 'perez ', firstName: ' laura' },
      { lastName: 'RIOS', firstName: 'LUCIA' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(2)
  })
})
