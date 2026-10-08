import { NextResponse } from 'next/server'
import { getAreas } from '@/lib/areas'
import { NOTIFICATION_SELECT, toNotificationItem, type NotificationRow } from '@/lib/notification-items'
import { countUnreadNotifications, RECENT_NOTIFICATIONS_LIMIT } from '@/lib/notifications'
import { getSession } from '@/lib/session'

// Últimas notificaciones para el panel de la campana (src/components/notifications/notification-bell.tsx),
// con el contador de no leídas para mantenerlo al día. RLS limita la consulta a las propias.
export async function GET() {
  const session = await getSession()
  if (!session?.role || session.mustChangePassword) return NextResponse.json({ error: 'sin-sesion' }, { status: 401 })

  const [{ data, error }, count, areas] = await Promise.all([
    session.supabase.from('notifications').select(NOTIFICATION_SELECT).order('created_at', { ascending: false }).limit(RECENT_NOTIFICATIONS_LIMIT),
    countUnreadNotifications(session.supabase),
    getAreas().then((result) => result ?? []),
  ])
  if (error) return NextResponse.json({ error: 'error' }, { status: 500 })

  const items = ((data ?? []) as NotificationRow[]).map((row) => toNotificationItem(row, session.role, areas))
  return NextResponse.json({ count, items }, { headers: { 'Cache-Control': 'no-store' } })
}
