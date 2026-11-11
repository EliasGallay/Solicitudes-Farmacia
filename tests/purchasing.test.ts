import { describe, expect, it } from 'vitest'
import { auditActionLabel } from '../src/lib/audit'
import { feedbackMessage } from '../src/lib/feedback'
import { purchasingNavigation } from '../src/lib/navigation'
import { COMMENT_MAX_LENGTH, commentSchema, managementErrorCode } from '../src/lib/request-management'
import { roleLabels, userRoles, userSchema } from '../src/lib/users'

const center = '10000000-0000-4000-8000-000000000001'
const user = { full_name: 'Ana Compras', email: 'compras@funes.gob.ar', health_center_id: center, areas: ['pharmacy'] }

describe('rol Compras', () => {
  it('se puede elegir en el alta de usuarios', () => expect(userRoles).toContain('purchasing'))
  it('se muestra como Compras', () => expect(roleLabels.purchasing).toBe('Compras'))
  it('no necesita centro ni rubros', () => expect(userSchema.safeParse({ ...user, role: 'purchasing', health_center_id: undefined, areas: [] }).success).toBe(true))
  it('el solicitante sigue necesitando centro', () => expect(userSchema.safeParse({ ...user, role: 'requester', health_center_id: undefined }).success).toBe(false))
  it('el menú muestra solo Solicitudes', () => expect(purchasingNavigation.map((item) => item.href)).toEqual(['/solicitudes']))
})

describe('comentarios en el historial', () => {
  it('recorta espacios', () => expect(commentSchema.parse('  Pedido a proveedor  ')).toBe('Pedido a proveedor'))
  it('rechaza un comentario vacío', () => expect(commentSchema.safeParse('   ').success).toBe(false))
  it('acepta hasta el largo máximo', () => expect(commentSchema.safeParse('a'.repeat(COMMENT_MAX_LENGTH)).success).toBe(true))
  it('rechaza un comentario más largo que el máximo', () => expect(commentSchema.safeParse('a'.repeat(COMMENT_MAX_LENGTH + 1)).success).toBe(false))
  it('traduce el error de la base', () => expect(managementErrorCode({ message: 'comentario-invalido' }, 'gestion-error')).toBe('comentario-invalido'))
  it('tiene mensajes de error y de éxito', () => {
    expect(feedbackMessage('comentario-invalido')).toBeDefined()
    expect(feedbackMessage('comentario-agregado')).toBeDefined()
  })
  it('tiene etiqueta en la auditoría', () => expect(auditActionLabel('request.comment')).toBe('Comentario agregado'))
})
