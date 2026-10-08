'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, CircleUser, ClipboardList, CirclePlus, FileText, House, Landmark, LogOut, Menu, Package, Settings2, Truck, Users, X, type LucideIcon } from 'lucide-react'
import { logout } from '@/app/login/actions'
import type { AppRole } from '@/lib/session'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { ProductTour, WorkflowTour } from '@/components/product-tour'
import { NotificationBell } from '@/components/notifications/notification-bell'

type NavItem = { label: string; icon: LucideIcon; href: string }

const requesterNavigation: NavItem[] = [
  { href: '/', label: 'Inicio', icon: House },
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/solicitudes/nueva', label: 'Nueva solicitud', icon: CirclePlus },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
]

// Administrative navigation is kept as it was; its screens are outside this UI scope.
// "Nueva solicitud" está oculta para el admin por ahora; la ruta sigue disponible.
const adminNavigation: NavItem[] = [
  { href: '/', label: 'Panel', icon: House },
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/entregas', label: 'Entregas', icon: Truck },
  { href: '/catalogos', label: 'Catálogos', icon: Package },
  { href: '/usuarios', label: 'Usuarios', icon: Users },
  { href: '/auditoria', label: 'Auditoría', icon: ClipboardList },
]

const itemClasses = 'flex h-11 shrink-0 items-center gap-3 rounded-md px-4 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 [&_svg]:size-5 [&_svg]:shrink-0'

type SidebarProps = { role: AppRole | null; userName: string; centerName: string | null }

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
  const items = role === 'admin' ? adminNavigation : requesterNavigation
  const current = activeHref(items, pathname)
  return (
    <nav data-tour="navigation" aria-label="Navegación principal" className={className}>
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

function Brand({ className }: { className?: string }) {
  return (
    <Link data-tour="brand" href="/" className={cn('flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', className)}>
      <Landmark className="size-9 shrink-0" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className="text-xs leading-4 font-bold tracking-wide uppercase">Municipalidad de Funes</span>
        <span className="text-sm leading-5 text-sidebar-muted">Solicitudes de Insumos</span>
      </span>
    </Link>
  )
}

// Contenido compartido entre el sidebar de desktop y el drawer de pantallas chicas.
function SidebarBody({ role, userName, centerName }: SidebarProps) {
  const pathname = usePathname()
  const onProfile = pathname === '/perfil'
  return (
    <>
      <Navigation role={role} className="flex flex-col gap-1" />
      <div data-tour="profile" className="mt-auto flex flex-col gap-1 border-t border-sidebar-muted/25 pt-4">
        <Link href="/perfil" title="Mi perfil" aria-current={onProfile ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-md px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', onProfile ? 'bg-sidebar-active text-white' : 'hover:bg-sidebar-hover')}>
          <CircleUser className={cn('size-8 shrink-0', onProfile ? 'text-white' : 'text-sidebar-muted')} aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm leading-5 font-semibold">{userName}</span>
            {centerName && <span className={cn('truncate text-xs leading-4', onProfile ? 'text-white/80' : 'text-sidebar-muted')}>{centerName}</span>}
            <span className="sr-only">Mi perfil</span>
          </span>
        </Link>
        <details className="group relative rounded-md">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 text-sm whitespace-nowrap text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
              <Settings2 className="size-5 shrink-0" aria-hidden />
              Sistema y tutoriales
            </span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="absolute right-0 bottom-full left-0 z-50 mb-2 flex flex-col gap-1 rounded-lg border border-sidebar-muted/30 bg-sidebar p-2 shadow-elevated">
            <ThemeToggle />
            <ProductTour role={role} />
            <WorkflowTour role={role} />
            <LogoutButton />
          </div>
        </details>
      </div>
    </>
  )
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-62.5 flex-col overflow-y-auto bg-sidebar p-3 text-sidebar-foreground lg:flex">
      <Brand className="mb-6 px-3 py-3" />
      <SidebarBody {...props} />
    </aside>
  )
}

// Debajo de lg: barra superior con la marca y un menú que abre el contenido del sidebar en un drawer.
// <dialog> modal: atrapa el foco, cierra con Esc y deja inerte el resto de la página.
export function MobileNavigation(props: SidebarProps) {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { dialogRef.current?.close() }, [pathname])

  function openMenu() {
    dialogRef.current?.showModal()
    setOpen(true)
  }

  useEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', open)
    return () => document.documentElement.classList.remove('overflow-hidden')
  }, [open])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-sidebar px-2 text-sidebar-foreground sm:px-4 lg:hidden">
      <Brand className="px-2 py-1 [&>svg]:size-7" />
      <div className="flex shrink-0 items-center gap-1">
        {props.role && <NotificationBell tone="sidebar" />}
        <button data-tour="navigation" type="button" aria-label="Abrir menú" aria-haspopup="dialog" aria-expanded={open} aria-controls="menu-principal" onClick={openMenu} className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
          <Menu className="size-6" aria-hidden />
        </button>
      </div>
      <dialog
        ref={dialogRef}
        id="menu-principal"
        aria-label="Menú principal"
        onClose={() => setOpen(false)}
        // Cierra al tocar el fondo o al elegir un enlace (también si es la página actual).
        onClick={(event) => { if (event.target === event.currentTarget || (event.target as Element).closest('a')) event.currentTarget.close() }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-transparent p-0 text-sidebar-foreground backdrop:bg-foreground/50 open:flex motion-safe:open:animate-enter-from-left"
      >
        <div className="flex w-full flex-col overflow-y-auto bg-sidebar p-3">
          <div className="mb-6 flex items-center justify-between gap-2">
            <Brand className="px-3 py-3" />
            <button type="button" aria-label="Cerrar menú" onClick={() => dialogRef.current?.close()} className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <SidebarBody {...props} />
        </div>
      </dialog>
    </header>
  )
}
