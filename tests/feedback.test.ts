import { describe, expect, it } from 'vitest'
import { feedbackMessage, withFeedback } from '../src/lib/feedback'

describe('mensajes de resultado por URL', () => {
  it('traduce un código conocido, con tildes correctas', () => expect(feedbackMessage('login-fallido')).toBe('No se pudo iniciar sesión. Revisá tu email y contraseña.'))
  it('ignora texto arbitrario de un enlace manipulado', () => expect(feedbackMessage('Tu cuenta fue bloqueada, llamá al 0800')).toBeUndefined())
  it('ignora propiedades heredadas', () => expect(feedbackMessage('toString')).toBeUndefined())
  it('ignora la ausencia de código', () => expect(feedbackMessage(undefined)).toBeUndefined())
  it('arma la URL solo con el código ASCII', () => expect(withFeedback('/login', 'error', 'login-fallido')).toBe('/login?error=login-fallido'))
})
