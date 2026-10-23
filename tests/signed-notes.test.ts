import { describe, expect, it } from 'vitest'
import { isSignedNoteType, signedNotePath } from '../src/lib/signed-notes'

describe('remitos firmados', () => {
  const deliveryId = '6f1c2a4e-1b7d-4c3a-9e2f-0a1b2c3d4e5f'

  it('guarda el archivo en la carpeta de la entrega', () => expect(signedNotePath(deliveryId, 'image/jpeg', 'abc')).toBe(`${deliveryId}/abc.jpg`))
  it('usa la extensión del tipo', () => expect(signedNotePath(deliveryId, 'application/pdf', 'abc')).toBe(`${deliveryId}/abc.pdf`))
  it('genera un nombre distinto por archivo', () => expect(signedNotePath(deliveryId, 'image/png')).not.toBe(signedNotePath(deliveryId, 'image/png')))
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('acepta %s', (type) => expect(isSignedNoteType(type)).toBe(true))
  it.each(['image/heic', 'image/svg+xml', 'text/html', 'toString'])('rechaza %s', (type) => expect(isSignedNoteType(type)).toBe(false))
})
