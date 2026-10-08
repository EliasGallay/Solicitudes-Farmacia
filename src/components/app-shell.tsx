import type { ReactNode } from 'react'
import { countUnreadNotifications } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { getSession, type AppRole } from '@/lib/session'
import { NotificationBell } from './notifications/notification-bell'
import { NotificationCountProvider } from './notifications/notification-count'
import { MobileNavigation, Sidebar } from './sidebar'

type ShellUser = { role: AppRole | null; fullName: string; centerName: string | null }

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = { role: session?.role ?? null, fullName: session?.fullName ?? '', centerName: session?.centerName ?? null }
  const unreadCount = session?.role ? await countUnreadNotifications(session.supabase) : 0
  return <ShellFrame user={user} unreadCount={unreadCount}>{children}</ShellFrame>
}

export function ShellFrame({ user, unreadCount = 0, children }: { user: ShellUser; unreadCount?: number; children: ReactNode }) {
  return (
    <NotificationCountProvider initialCount={unreadCount}>
      <div className="min-h-screen bg-page">
        <Sidebar role={user.role} userName={user.fullName} centerName={user.centerName} />
        <div className="min-w-0 lg:pl-62.5">
          <MobileNavigation role={user.role} userName={user.fullName} centerName={user.centerName} />
          {/* Desktop: barra superior con la campana a la derecha (en mobile la campana va en la barra de MobileNavigation). */}
          {user.role && (
            <div className="sticky top-0 z-10 hidden h-16 items-center justify-end bg-page/85 px-8 backdrop-blur-sm lg:flex">
              <NotificationBell tone="page" />
            </div>
          )}
          <main className={cn('min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:p-8', user.role && 'lg:pt-2')}>{children}</main>
        </div>
      </div>
    </NotificationCountProvider>
  )
}
