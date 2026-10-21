import type { ReactNode } from 'react'
import { countUnreadNotifications } from '@/lib/notifications'
import { countPendingReceipts } from '@/lib/requests'
import { getSession, type AppRole } from '@/lib/session'
import { NotificationCountProvider } from './notifications/notification-count'
import { TourController } from './product-tour'
import { MobileNavigation, Sidebar } from './sidebar'

type ShellUser = { role: AppRole | null; fullName: string; centerName: string | null; pendingReceipts?: number }

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = { role: session?.role ?? null, fullName: session?.fullName ?? '', centerName: session?.centerName ?? null }
  const [unreadCount, pendingReceipts] = await Promise.all([
    session?.role ? countUnreadNotifications(session.supabase) : 0,
    session?.role === 'requester' ? countPendingReceipts(session.supabase) : undefined,
  ])
  return <ShellFrame user={{ ...user, pendingReceipts }} unreadCount={unreadCount}>{children}</ShellFrame>
}

export function ShellFrame({ user, unreadCount = 0, children }: { user: ShellUser; unreadCount?: number; children: ReactNode }) {
  return (
    <NotificationCountProvider initialCount={unreadCount}>
      <div className="min-h-screen bg-page">
        <Sidebar role={user.role} userName={user.fullName} centerName={user.centerName} pendingReceipts={user.pendingReceipts} />
        <div className="min-w-0 lg:pl-62.5">
          <MobileNavigation role={user.role} userName={user.fullName} centerName={user.centerName} pendingReceipts={user.pendingReceipts} />
          {/* La campana y la ayuda de la pantalla van en el sidebar (desktop) o en la barra de MobileNavigation. */}
          <main data-tour="main" className="min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:p-8">{children}</main>
        </div>
      </div>
      <TourController role={user.role} />
    </NotificationCountProvider>
  )
}
