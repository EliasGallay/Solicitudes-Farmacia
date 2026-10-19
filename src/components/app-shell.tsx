import type { ReactNode } from 'react'
import { countUnreadNotifications } from '@/lib/notifications'
import { countPendingReceipts } from '@/lib/requests'
import { cn } from '@/lib/utils'
import { getSession, type AppRole } from '@/lib/session'
import { NotificationBell } from './notifications/notification-bell'
import { NotificationCountProvider } from './notifications/notification-count'
import { ScreenHelpButton, TourController } from './product-tour'
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
          {/* Desktop: barra superior con la campana a la derecha (en mobile la campana va en la barra de MobileNavigation). */}
          {user.role && (
            <div className="sticky top-0 z-10 hidden h-16 items-center justify-end gap-1 bg-page/85 px-8 backdrop-blur-sm lg:flex">
              <ScreenHelpButton role={user.role} className="text-foreground-secondary hover:bg-surface-hover hover:text-foreground" />
              <NotificationBell tone="page" />
            </div>
          )}
          <main data-tour="main" className={cn('min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:p-8', user.role && 'lg:pt-2')}>{children}</main>
        </div>
      </div>
      <TourController role={user.role} />
    </NotificationCountProvider>
  )
}
