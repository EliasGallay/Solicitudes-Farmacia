import { describe, expect, it } from 'vitest'
import { openQuantity } from '../src/lib/quantities'

describe('saldo abierto', () => {
  it('calcula el saldo con cierre', () => expect(openQuantity(100, 60, 40)).toBe(0))
  it('conserva cierre al anular una entrega', () => expect(openQuantity(100, 0, 40)).toBe(60))
  it('rechaza sobreentregas', () => expect(() => openQuantity(100, 101, 0)).toThrow())
  it('rechaza cantidades fraccionarias', () => expect(() => openQuantity(100, 1.5, 0)).toThrow())
})
