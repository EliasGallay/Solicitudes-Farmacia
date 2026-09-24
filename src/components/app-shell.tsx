import type { ReactNode } from 'react'
import { getSession, type AppRole } from '@/lib/session'
import { MobileNavigation, Sidebar } from './sidebar'

type ShellUser = { role: AppRole | null; fullName: string; centerName: string | null }

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = { role: session?.role ?? null, fullName: session?.fullName ?? '', centerName: session?.centerName ?? null }
  return <ShellFrame user={user}>{children}</ShellFrame>
}

export function ShellFrame({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <Sidebar role={user.role} userName={user.fullName} centerName={user.centerName} />
      <div className="min-w-0 md:pl-62.5">
        <MobileNavigation role={user.role} />
        <main className="px-4 py-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
