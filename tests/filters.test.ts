import { describe, expect, it } from 'vitest'
import { ilikeAny, ilikePattern } from '../src/lib/filters'

describe('filtros ilike para PostgREST', () => {
  it('envuelve el término con comodines y comillas', () => expect(ilikePattern('gasa')).toBe('"%gasa%"'))
  it('escapa los comodines de LIKE', () => expect(ilikePattern('50%_x')).toBe('"%50\\\\%\\\\_x%"'))
  it('escapa comillas y conserva comas y paréntesis', () => expect(ilikePattern('a,"b"(c)')).toBe('"%a,\\"b\\"(c)%"'))
  it('combina columnas en un filtro or', () => expect(ilikeAny(['name', 'presentation'], 'x')).toBe('name.ilike."%x%",presentation.ilike."%x%"'))
})
