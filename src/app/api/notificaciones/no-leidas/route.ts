import { NextResponse } from 'next/server'
import { countUnreadNotifications } from '@/lib/notifications'
import { getSession } from '@/lib/session'

// Contador de no leídas para el shell (src/components/notifications/notification-count.tsx). Es un
// GET y no una server action para no encolarse detrás de los formularios.
export async function GET() {
  const session = await getSession()
  if (!session?.role || session.mustChangePassword) return NextResponse.json({ count: 0 }, { status: 401 })
  const count = await countUnreadNotifications(session.supabase)
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } })
}
