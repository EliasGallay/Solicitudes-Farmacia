import { describe, expect, it } from 'vitest'
import { formatRequestNumber, parseRequestNumber } from '../src/lib/requests'

describe('número de solicitud', () => {
  it('formatea con prefijo SOL', () => expect(formatRequestNumber(1024)).toBe('#SOL-1024'))
  it.each(['1024', '#1024', 'SOL-1024', '#SOL-1024', 'sol1024', ' #sol-1024 '])('interpreta %s', (value) => expect(parseRequestNumber(value)).toBe(1024))
  it.each(['', 'abc', 'SOL-', '10.5', '-3'])('rechaza %s', (value) => expect(parseRequestNumber(value)).toBeNull())
})
