import Link from 'next/link'
import type { ReactNode } from 'react'
import { logout } from '../app/login/actions'

const navigation = [
  { href: '/', label: 'Panel', icon: '⌂' },
  { href: '/nueva-solicitud', label: 'Nueva solicitud', icon: '+' },
  { href: '/solicitudes', label: 'Solicitudes', icon: '≡' },
  { href: '/entregas', label: 'Entregas', icon: '□' },
  { href: '/catalogos', label: 'Catálogos', icon: '▦' },
  { href: '/usuarios', label: 'Usuarios', icon: '◉' },
  { href: '/auditoria', label: 'Auditoría', icon: '◌' },
]

function Navigation() {
  return (
    <nav className="space-y-1">
      {navigation.map((item) => (
        <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary-foreground/75 transition hover:bg-primary-foreground/10 hover:text-primary-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-foreground/10 text-sm font-semibold text-primary-foreground/80">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="fixed inset-y-0 left-0 z-20 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-primary-foreground/10 bg-primary p-4 text-primary-foreground md:flex md:flex-col">
        <Link href="/" className="mb-8 px-3 text-lg font-bold tracking-tight text-primary-foreground">Solicitudes de Farmacia</Link>
        <Navigation />
        <form action={logout} className="mt-auto border-t border-primary-foreground/15 pt-4">
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground">Cerrar sesión</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1 md:pl-64">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
          <Link href="/" className="font-bold text-foreground">Solicitudes de Farmacia</Link>
          <form action={logout}><button type="submit" className="text-sm text-muted-foreground">Salir</button></form>
        </header>
        <div className="border-b border-border bg-card px-4 py-2 md:hidden"><Navigation /></div>
        <main>{children}</main>
      </div>
    </div>
  )
}
