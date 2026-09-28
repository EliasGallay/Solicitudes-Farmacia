import { describe, expect, it } from 'vitest'
import { generateTemporaryPassword, initials, newUserSchema, passwordSchema, profileSchema, userSchema } from '../src/lib/users'

const center = '10000000-0000-4000-8000-000000000001'
const requester = { full_name: ' María López ', email: ' Maria@Funes.gob.ar ', role: 'requester' as const, health_center_id: center, areas: ['pharmacy'] }

describe('validación de usuarios', () => {
  it('normaliza nombre y email', () => {
    const parsed = userSchema.parse(requester)
    expect(parsed.full_name).toBe('María López')
    expect(parsed.email).toBe('maria@funes.gob.ar')
  })
  it('el solicitante necesita centro', () => expect(userSchema.safeParse({ ...requester, health_center_id: undefined }).success).toBe(false))
  it('el solicitante necesita al menos un rubro', () => expect(userSchema.safeParse({ ...requester, areas: [] }).success).toBe(false))
  it('el admin no necesita centro ni rubros', () => expect(userSchema.safeParse({ ...requester, role: 'admin', health_center_id: undefined, areas: [] }).success).toBe(true))
  it('el alta exige contraseña temporal', () => {
    expect(newUserSchema.safeParse({ ...requester, password: 'corta' }).success).toBe(false)
    expect(newUserSchema.safeParse({ ...requester, password: 'suficiente' }).success).toBe(true)
  })
})

describe('contraseña temporal', () => {
  it('tiene el largo pedido y pasa la validación', () => {
    const password = generateTemporaryPassword()
    expect(password).toHaveLength(12)
    expect(passwordSchema.safeParse(password).success).toBe(true)
  })
  it('incluye minúsculas, mayúsculas y números sin caracteres ambiguos', () => {
    for (let index = 0; index < 50; index += 1) {
      const password = generateTemporaryPassword()
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).not.toMatch(/[0O1lI]/)
    }
  })
})

describe('datos personales', () => {
  it('normaliza el nombre', () => expect(profileSchema.parse({ full_name: '  Ana Pérez ' }).full_name).toBe('Ana Pérez'))
  it('exige un nombre no vacío', () => expect(profileSchema.safeParse({ full_name: '   ' }).success).toBe(false))
})

describe('iniciales', () => {
  it('usa la primera y la última palabra', () => expect(initials('María del Carmen López')).toBe('ML'))
  it('con una sola palabra usa su inicial', () => expect(initials('farmacia')).toBe('F'))
  it('ignora espacios de más', () => expect(initials('  Ana   Pérez ')).toBe('AP'))
  it('conserva tildes', () => expect(initials('Ángel Ñandú')).toBe('ÁÑ'))
  it('sin nombre muestra un signo', () => expect(initials('   ')).toBe('?'))
})
