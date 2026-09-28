import { describe, expect, it } from 'vitest'
import { keyParamSchema } from '../src/lib/filters'
import { productTypeKey } from '../src/lib/product-types'

describe('clave de tipo de producto', () => {
  it('normaliza acentos, mayúsculas y espacios', () => expect(productTypeKey('Artículos de Limpieza')).toBe('articulos_de_limpieza'))
  it('colapsa separadores y recorta los extremos', () => expect(productTypeKey('  Papel -- higiénico!  ')).toBe('papel_higienico'))
  it('no empieza con número', () => expect(productTypeKey('3M cintas')).toBe('m_cintas'))
  it('queda vacía sin letras', () => expect(productTypeKey('123 !!')).toBe(''))
  it('cumple el formato de la base', () => expect(keyParamSchema.parse(productTypeKey('Ñandú 500 ml'))).toBe('nandu_500_ml'))
})
