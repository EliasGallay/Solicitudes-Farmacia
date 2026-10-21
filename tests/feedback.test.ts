import { describe, expect, it } from 'vitest'
import { feedbackMessage, withFeedback } from '../src/lib/feedback'
import { managementErrorCode } from '../src/lib/request-management'

describe('mensajes de resultado por URL', () => {
  it('traduce un código conocido, con tildes correctas', () => expect(feedbackMessage('login-fallido')).toBe('No se pudo iniciar sesión. Revisá tu email y contraseña.'))
  it('ignora texto arbitrario de un enlace manipulado', () => expect(feedbackMessage('Tu cuenta fue bloqueada, llamá al 0800')).toBeUndefined())
  it('ignora propiedades heredadas', () => expect(feedbackMessage('toString')).toBeUndefined())
  it('ignora la ausencia de código', () => expect(feedbackMessage(undefined)).toBeUndefined())
  it('arma la URL solo con el código ASCII', () => expect(withFeedback('/login', 'error', 'login-fallido')).toBe('/login?error=login-fallido'))
  it('conserva la query existente de la ruta', () => expect(withFeedback('/catalogos/tipos?nuevo=1', 'error', 'tipo-duplicado')).toBe('/catalogos/tipos?nuevo=1&error=tipo-duplicado'))
})

describe('errores de las RPCs de gestión', () => {
  it.each(['requerimiento-invalido', 'requerimiento-sin-pendiente', 'cierre-ya-anulado', 'cierre-no-anulable'])('traduce %s a un mensaje', (code) => expect(feedbackMessage(managementErrorCode({ message: code }, 'gestion-error'))).not.toBe(feedbackMessage('gestion-error')))
  it('usa el fallback ante un mensaje técnico', () => expect(managementErrorCode({ message: 'duplicate key value violates unique constraint' }, 'gestion-error')).toBe('gestion-error'))
})
