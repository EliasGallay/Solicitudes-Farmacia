'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleUser, ClipboardList, CirclePlus, FileText, House, Landmark, LogOut, Package, Truck, Users, type LucideIcon } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { AppRole } from '@/lib/session'
import { cn } from '@/lib/utils'

type NavItem = { label: string; icon: LucideIcon; href: string }

const pharmacistNavigation: NavItem[] = [
  { href: '/', label: 'Inicio', icon: House },
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/solicitudes/nueva', label: 'Nueva solicitud', icon: CirclePlus },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
]

// Administrative navigation is kept as it was; its screens are outside this UI scope.
const adminNavigation: NavItem[] = [
  { href: '/', label: 'Panel', icon: House },
  { href: '/solicitudes/nueva', label: 'Nueva solicitud', icon: CirclePlus },
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/entregas', label: 'Entregas', icon: Truck },
  { href: '/catalogos', label: 'Catálogos', icon: Package },
  { href: '/usuarios', label: 'Usuarios', icon: Users },
  { href: '/auditoria', label: 'Auditoría', icon: ClipboardList },
]

const itemClasses = 'flex h-11 shrink-0 items-center gap-3 rounded-md px-4 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 [&_svg]:size-5 [&_svg]:shrink-0'

function activeHref(items: NavItem[], pathname: string) {
  return items
    .map((item) => item.href)
    .filter((href) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0]
}

export function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn(itemClasses, active ? 'bg-sidebar-active font-semibold text-white' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground')}>
      <Icon />
      {item.label}
    </Link>
  )
}

function Navigation({ role, className }: { role: AppRole | null; className?: string }) {
  const pathname = usePathname()
  const items = role === 'admin' ? adminNavigation : pharmacistNavigation
  const current = activeHref(items, pathname)
  return (
    <nav aria-label="Navegación principal" className={className}>
      {items.map((item) => <SidebarItem key={item.label} item={item} active={item.href === current} />)}
    </nav>
  )
}

function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={cn(itemClasses, 'w-full text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground', className)}>
        <LogOut />
        Cerrar sesión
      </button>
    </form>
  )
}

export function Sidebar({ role, userName, centerName }: { role: AppRole | null; userName: string; centerName: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-62.5 flex-col overflow-y-auto bg-sidebar p-3 text-sidebar-foreground md:flex">
      <Link href="/" className="mb-6 flex items-center gap-3 rounded-md px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
        <Landmark className="size-9 shrink-0" aria-hidden />
        <span className="flex flex-col">
          <span className="text-xs leading-4 font-bold tracking-wide uppercase">Municipalidad de Funes</span>
          <span className="text-sm leading-5 text-sidebar-muted">Solicitudes de Farmacia</span>
        </span>
      </Link>
      <Navigation role={role} className="flex flex-col gap-1" />
      <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-muted/25 pt-4">
        <div className="flex items-center gap-3 px-4 py-2">
          <CircleUser className="size-8 shrink-0 text-sidebar-muted" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm leading-5 font-semibold">{userName}</span>
            {centerName && <span className="truncate text-xs leading-4 text-sidebar-muted">{centerName}</span>}
          </span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}

// Basic fallback below md: no specific mobile design is defined yet.
export function MobileNavigation({ role }: { role: AppRole | null }) {
  return (
    <div className="flex gap-1 overflow-x-auto bg-sidebar p-2 md:hidden">
      <Navigation role={role} className="flex gap-1" />
      <LogoutButton />
    </div>
  )
}
