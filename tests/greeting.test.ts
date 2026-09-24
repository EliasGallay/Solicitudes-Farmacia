import { describe, expect, it } from 'vitest'
import { greeting } from '../src/lib/greeting'

// Argentina es UTC-3 todo el año: la hora local es la hora UTC menos 3.
const at = (utcHour: number, utcMinute = 0) => new Date(Date.UTC(2026, 8, 24, utcHour, utcMinute))

describe('saludo según la hora de Argentina', () => {
  it('buenos días desde las 6', () => expect(greeting(at(9))).toBe('Buenos días'))
  it('buenas noches hasta las 5:59', () => expect(greeting(at(8, 59))).toBe('Buenas noches'))
  it('buenas tardes desde las 12', () => expect(greeting(at(15))).toBe('Buenas tardes'))
  it('buenas noches desde las 20', () => expect(greeting(at(23))).toBe('Buenas noches'))
  it('buenas noches a medianoche', () => expect(greeting(at(3))).toBe('Buenas noches'))
})
