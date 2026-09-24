import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, likeContains, listHref, normalizeSearch, pageRange, pageSizeParam, pageSizeParamSchema, searchTokens } from '../src/lib/filters'

describe('búsqueda normalizada', () => {
  it('quita acentos y mayúsculas', () => expect(normalizeSearch('Algodón ÑANDÚ')).toBe('algodon nandu'))
  it('separa en palabras únicas', () => expect(searchTokens('  Para  500 para ')).toEqual(['para', '500']))
  it('ignora búsquedas vacías', () => expect(searchTokens('   ')).toEqual([]))
  it('limita la cantidad de palabras', () => expect(searchTokens('a b c d e f g h')).toHaveLength(6))
})

describe('patrón ilike', () => {
  it('envuelve con comodines', () => expect(likeContains('gasa')).toBe('%gasa%'))
  it('escapa los comodines de LIKE', () => expect(likeContains('50%_x')).toBe('%50\\%\\_x%'))
})

describe('url de listados', () => {
  it('omite filtros vacíos y la página 1', () => expect(listHref('/solicitudes', { buscar: 'x', estado: undefined })).toBe('/solicitudes?buscar=x'))
  it('agrega la página', () => expect(listHref('/catalogo', {}, 3)).toBe('/catalogo?page=3'))
})

describe('paginación', () => {
  it('acepta solo los tamaños permitidos', () => {
    expect(pageSizeParamSchema.parse('25')).toBe(25)
    expect(pageSizeParamSchema.parse('5')).toBe(5)
    expect(pageSizeParamSchema.parse('7')).toBe(DEFAULT_PAGE_SIZE)
    expect(pageSizeParamSchema.parse(undefined)).toBe(DEFAULT_PAGE_SIZE)
  })
  it('omite el tamaño por defecto en la URL', () => {
    expect(pageSizeParam(DEFAULT_PAGE_SIZE)).toBeUndefined()
    expect(pageSizeParam(15)).toBe('15')
  })
  it('calcula el rango de la página', () => expect(pageRange(3, 15)).toEqual([30, 44]))
})
