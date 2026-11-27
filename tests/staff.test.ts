import { describe, expect, it } from 'vitest'
import { normalizeName, validateLeaveInput } from '../src/lib/staff'

describe('validateLeaveInput', () => {
  it('acepta días distintos del rango (fin de semana incluido)', () => {
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-02', endsOn: '2026-12-06', days: 3 })).toEqual({ ok: true })
  })

  it('acepta permiso de 1,5 hs y de 3 hs en un solo día', () => {
    expect(validateLeaveInput({ kind: 'hours_permit', startsOn: '2026-12-02', hours: 1.5 })).toEqual({ ok: true })
    expect(validateLeaveInput({ kind: 'hours_permit', startsOn: '2026-12-02', hours: 3 })).toEqual({ ok: true })
  })

  it('rechaza permiso de 2 hs', () => {
    expect(validateLeaveInput({ kind: 'hours_permit', startsOn: '2026-12-02', hours: 2 })).toEqual({ ok: false, code: 'staff_invalid_hours' })
  })

  it('rechaza permiso con días descontados', () => {
    expect(validateLeaveInput({ kind: 'hours_permit', startsOn: '2026-12-02', hours: 3, days: 1 })).toEqual({ ok: false, code: 'staff_invalid_days' })
  })

  it('rechaza fin anterior al inicio', () => {
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-06', endsOn: '2026-12-02', days: 3 })).toEqual({ ok: false, code: 'staff_invalid_range' })
  })

  it('rechaza días fuera de 1 a 366', () => {
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-02', endsOn: '2026-12-06', days: 0 })).toEqual({ ok: false, code: 'staff_invalid_days' })
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-02', endsOn: '2026-12-06', days: 367 })).toEqual({ ok: false, code: 'staff_invalid_days' })
  })

  it('exige nota en "otra licencia"', () => {
    expect(validateLeaveInput({ kind: 'other', startsOn: '2026-12-02', endsOn: '2026-12-02', days: 1, note: '  ' }))
      .toEqual({ ok: false, code: 'staff_note_required' })
  })

  it('rechaza un tipo desconocido', () => {
    expect(validateLeaveInput({ kind: 'sabbatical', startsOn: '2026-12-02', endsOn: '2026-12-02', days: 1 }))
      .toEqual({ ok: false, code: 'staff_invalid_kind' })
  })
})

describe('normalizeName', () => {
  it('colapsa espacios y quita bordes', () => {
    expect(normalizeName('  RIOS   LUCIA ')).toBe('RIOS LUCIA')
  })
})

describe('menú de Gestión de personal', () => {
  it('aparece solo en el menú de admin', async () => {
    const { adminNavigation, requesterNavigation } = await import('../src/lib/navigation')
    expect(adminNavigation.map((item) => item.href)).toContain('/personal')
    expect(adminNavigation.find((item) => item.href === '/personal')?.label).toBe('Gestión de personal')
    expect(requesterNavigation({ supplies: true, fleet: true }).map((item) => item.href)).not.toContain('/personal')
  })
})

import { currentStatus, formatDate, formatPersonName, staffMemberSchema } from '../src/lib/staff'

describe('formatDate', () => {
  it('muestra dd/mm/aaaa', () => {
    expect(formatDate('2026-12-02')).toBe('02/12/2026')
    expect(formatDate('1998-06-05')).toBe('05/06/1998')
  })
})

describe('formatPersonName', () => {
  it('pone mayúscula inicial en cada palabra y conserva acentos', () => {
    expect(formatPersonName('GALLAY ELÍAS')).toBe('Gallay Elías')
    expect(formatPersonName('  de  la   fuente ')).toBe('De La Fuente')
  })
  it('normaliza guiones', () => {
    expect(formatPersonName('ana-maria')).toBe('Ana-Maria')
  })
})

describe('staffMemberSchema', () => {
  it('guarda nombre y apellido en formato Apellido, Nombre', () => {
    const parsed = staffMemberSchema.parse({ first_name: 'elias', last_name: 'GALLAY', health_center_ids: [] })
    expect(parsed.first_name).toBe('Elias')
    expect(parsed.last_name).toBe('Gallay')
  })
})

describe('currentStatus', () => {
  const today = '2026-11-26'
  it('figura trabajando sin licencias activas', () => {
    expect(currentStatus([], today)).toEqual({ label: 'Trabajando', tone: 'working' })
  })
  it('muestra vacaciones hasta la fecha de fin', () => {
    expect(currentStatus([{ kind: 'vacation', startsOn: '2026-11-25', endsOn: '2026-12-02', hours: null }], today))
      .toEqual({ label: 'Vacaciones hasta 02/12/2026', tone: 'leave' })
  })
  it('muestra el permiso de horas del día', () => {
    expect(currentStatus([{ kind: 'hours_permit', startsOn: '2026-11-26', endsOn: '2026-11-26', hours: 1.5 }], today))
      .toEqual({ label: 'Permiso 1,5 hs', tone: 'leave' })
  })
  it('ignora licencias que ya terminaron', () => {
    expect(currentStatus([{ kind: 'other', startsOn: '2026-11-01', endsOn: '2026-11-10', hours: null }], today).label).toBe('Trabajando')
  })
})

import { daysBetween, formatDni, yearsSince } from '../src/lib/staff'

describe('formatDni', () => {
  it('agrupa de a tres con puntos', () => {
    expect(formatDni('30111222')).toBe('30.111.222')
    expect(formatDni('9876543')).toBe('9.876.543')
  })
})

describe('yearsSince', () => {
  it('cuenta años cumplidos', () => {
    expect(yearsSince('2012-08-01', '2026-11-27')).toBe(14)
    expect(yearsSince('2012-12-01', '2026-11-27')).toBe(13)
  })
})

describe('daysBetween', () => {
  it('cuenta días corridos entre dos fechas ISO', () => {
    expect(daysBetween('2026-11-27', '2026-12-03')).toBe(6)
  })
})
