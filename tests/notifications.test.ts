import { describe, expect, it } from 'vitest'
import { formatRelativeTime, formatUnreadCount, notificationHref, notificationKinds, notificationText, type NotificationContext } from '../src/lib/notifications'

const base: NotificationContext = { kind: 'request.created', recipientRole: 'admin', requestNumber: 12, deliveryNumber: null, centerName: 'CAPS Norte', areaName: 'Farmacia' }

describe('textos de notificaciones', () => {
  it('avisa al admin de una solicitud nueva con centro y rubro', () => expect(notificationText(base)).toEqual({ title: 'Solicitud nueva', body: 'CAPS Norte envió la solicitud #SOL-12 (Farmacia).' }))
  it('al centro le habla de su centro', () => expect(notificationText({ ...base, recipientRole: 'requester' }).body).toBe('Se cargó la solicitud #SOL-12 de tu centro (Farmacia).'))
  it('al admin le nombra el centro en las entregas', () => expect(notificationText({ ...base, kind: 'delivery.voided', deliveryNumber: 7 }).body).toBe('Se anuló la entrega #REM-7 de la solicitud #SOL-12 de CAPS Norte. Sus cantidades volvieron a quedar pendientes.'))
  it('al centro le pide confirmar la recepción', () => expect(notificationText({ ...base, kind: 'delivery.registered', recipientRole: 'requester', deliveryNumber: 7 }).body).toBe('Se registró la entrega #REM-7 de la solicitud #SOL-12 de tu centro. Confirmá la recepción cuando llegue.'))
  it('distingue la recepción conforme de la diferencia', () => {
    expect(notificationText({ ...base, kind: 'delivery.received' }).title).toBe('Recepción confirmada')
    expect(notificationText({ ...base, kind: 'receipt.difference', recipientRole: 'requester' }).body).toBe('Se informó que llegó menos de lo entregado en la solicitud #SOL-12 de tu centro. La administración la va a revisar.')
  })
  it('usa un texto genérico si la solicitud ya no es visible', () => expect(notificationText({ ...base, kind: 'items.closed', requestNumber: null, centerName: null, areaName: null }).body).toBe('Se cerraron cantidades pendientes de una solicitud: no se van a entregar.'))
  it('tiene texto para cada tipo', () => {
    for (const kind of notificationKinds) for (const recipientRole of ['admin', 'requester'] as const) expect(notificationText({ ...base, kind, recipientRole, deliveryNumber: 7 }).title).not.toBe('Novedad')
  })
  it('no falla con un tipo desconocido', () => expect(notificationText({ ...base, kind: 'otro.tipo' }).title).toBe('Novedad'))
})

describe('destino y contador', () => {
  it('una entrega registrada lleva a confirmar la recepción', () => expect(notificationHref('delivery.registered', 'abc')).toBe('/solicitudes/abc/recibir'))
  it('el resto lleva al detalle de la solicitud', () => expect(notificationHref('receipt.difference', 'abc')).toBe('/solicitudes/abc'))
  it('acota el contador a 99+', () => {
    expect(formatUnreadCount(5)).toBe('5')
    expect(formatUnreadCount(150)).toBe('99+')
  })
})

describe('tiempo relativo del panel', () => {
  const now = Date.parse('2026-10-08T15:00:00-03:00')
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
  it('muestra minutos, horas y días', () => {
    expect(formatRelativeTime(ago(0), now)).toBe('Recién')
    expect(formatRelativeTime(ago(5), now)).toBe('Hace 5 min')
    expect(formatRelativeTime(ago(180), now)).toBe('Hace 3 h')
    expect(formatRelativeTime(ago(26 * 60), now)).toBe('Ayer')
    expect(formatRelativeTime(ago(4 * 24 * 60), now)).toBe('Hace 4 días')
  })
  it('después de una semana muestra la fecha', () => expect(formatRelativeTime('2026-09-20T12:00:00-03:00', now)).toMatch(/20/))
  it('una fecha futura (reloj desfasado) cuenta como recién', () => expect(formatRelativeTime(ago(-3), now)).toBe('Recién'))
})
