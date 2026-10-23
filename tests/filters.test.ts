import { describe, expect, it, vi } from 'vitest'
import { applySearch, containsAnyFilter, DEFAULT_PAGE_SIZE, keyParamSchema, likeContains, listHref, matchesSearch, normalizeSearch, pageRange, pageSizeParam, pageSizeParamSchema, searchTerms, searchTokens } from '../src/lib/filters'

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

describe('búsqueda tolerante a errores de tipeo', () => {
  const rpc = (data: unknown, error: unknown = null) => ({ rpc: vi.fn(async () => ({ data, error })) }) as never

  it('suma las palabras parecidas a cada palabra buscada', async () => {
    const client = rpc([{ token: 'diasepam', variants: ['diazepam'] }])
    expect(await searchTerms(client, 'productos', 'Diasepam 10')).toEqual([['diasepam', 'diazepam'], ['10']])
  })
  it('no consulta si ninguna palabra llega al largo mínimo', async () => {
    const client = { rpc: vi.fn() }
    expect(await searchTerms(client as never, 'productos', 'sal 10')).toEqual([['sal'], ['10']])
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('si la consulta falla busca solo lo escrito', async () => {
    expect(await searchTerms(rpc(null, { message: 'x' }), 'productos', 'gasas')).toEqual([['gasas']])
  })
  it('arma el filtro or con valores entre comillas', () => {
    expect(containsAnyFilter('product_search_text', ['diasepam', 'a,b'])).toBe('product_search_text.ilike."%diasepam%",product_search_text.ilike."%a,b%"')
  })
  it('escapa comillas y barras dentro del valor', () => {
    expect(containsAnyFilter('c', ['a"b', '50%'])).toBe(String.raw`c.ilike."%a\"b%",c.ilike."%50\\%%"`)
  })
  it('aplica un or por grupo', () => {
    const calls: string[] = []
    const query = { or: (filters: string) => { calls.push(filters); return query } }
    applySearch(query, 'c', [['a', 'b'], ['c']])
    expect(calls).toEqual(['c.ilike."%a%",c.ilike."%b%"', 'c.ilike."%c%"'])
  })
  it('filtra en memoria con la misma regla', () => {
    expect(matchesSearch('Medicación oral', [['medicasion', 'medicacion']])).toBe(true)
    expect(matchesSearch('Descartable', [['gasa']])).toBe(false)
  })
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

describe('claves de rubro y tipo', () => {
  it('acepta claves válidas', () => expect(keyParamSchema.parse('pharmacy')).toBe('pharmacy'))
  it('descarta claves con otro formato', () => expect(keyParamSchema.parse('Farmacia; drop')).toBeUndefined())
  it('es opcional', () => expect(keyParamSchema.parse(undefined)).toBeUndefined())
})
