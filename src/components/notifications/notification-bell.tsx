'use client'

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { markAllNotificationsReadInPanel } from '@/app/notification-actions'
import { Skeleton } from '@/components/ui/skeleton'
import type { NotificationItem } from '@/lib/notification-items'
import { formatRelativeTime } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import { NotificationEntry } from './notification-entry'
import { UnreadBadge, useNotificationState } from './notification-count'

const bellTones = {
  // Barra mobile, sobre el color del sidebar.
  sidebar: 'text-sidebar-foreground hover:bg-sidebar-hover',
  // Barra superior de desktop, sobre el fondo de la página.
  page: 'text-foreground-secondary hover:bg-surface-muted hover:text-foreground',
}
const openTones = { sidebar: 'bg-sidebar-hover', page: 'bg-surface-muted text-foreground' }

// Borde del contador del color del fondo, para separarlo del ícono.
const badgeRings = { sidebar: 'ring-sidebar', page: 'ring-page' }

// En desktop el panel cuelga de la campana; en mobile ocupa el ancho de la pantalla debajo de la barra.
const panelPositions = {
  sidebar: 'fixed inset-x-2 top-16',
  page: 'absolute top-full right-0 mt-2 w-96',
}

type PanelState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: NotificationItem[] }

// Campana de la parte superior derecha. Mientras haya sin leer, el contador late; cuando llega una
// nueva, la campana se sacude y el contador aparece con un rebote (todo con `motion-safe:`).
// Al tocarla despliega las últimas notificaciones, con "Ver todas" al pie.
export function NotificationBell({ tone, className }: { tone: keyof typeof bellTones; className?: string }) {
  const { count, arrivals, setCount } = useNotificationState()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<PanelState>({ status: 'loading' })
  const [marking, startMarking] = useTransition()
  const [markError, setMarkError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const panelId = useId()
  const label = count > 0 ? `Notificaciones: ${count} sin leer` : 'Notificaciones'

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notificaciones/recientes', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const data = (await response.json()) as { count: number; items: NotificationItem[] }
      setPanel({ status: 'ready', items: data.items })
      setCount(data.count)
    } catch {
      setPanel({ status: 'error' })
    }
  }, [setCount])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setMarkError(null)
    // Se recarga en cada apertura; mientras tanto se muestra lo último cargado.
    setPanel((current) => current.status === 'ready' ? current : { status: 'loading' })
    void load()
  }

  // Se cierra al navegar (por ejemplo, al abrir una notificación o "Ver todas").
  useEffect(() => { setOpen(false) }, [pathname])

  // Se cierra con Esc (devolviendo el foco a la campana) o tocando fuera.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  function markAll() {
    startMarking(async () => {
      const result = await markAllNotificationsReadInPanel()
      if (result.error) {
        setMarkError(result.error)
        return
      }
      setMarkError(null)
      setCount(0)
      setPanel((current) => current.status === 'ready' ? { status: 'ready', items: current.items.map((item) => ({ ...item, unread: false })) } : current)
    })
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        data-tour="notifications-bell"
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn('relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', bellTones[tone], open && openTones[tone])}
      >
        {/* `key` reinicia la animación en cada llegada. */}
        <span key={arrivals} className={cn('flex origin-top', arrivals > 0 && 'motion-safe:animate-bell-ring')}>
          <Bell className="size-6" aria-hidden />
        </span>
        {count > 0 && (
          <span className="absolute top-0.5 right-0 flex">
            <span aria-hidden className="absolute inset-0 rounded-full bg-danger motion-safe:animate-badge-ping" />
            <UnreadBadge key={count} count={count} className={cn('relative min-w-5 ring-2 motion-safe:animate-step-pop', badgeRings[tone])} />
          </span>
        )}
      </button>
      {/* Anuncia las llegadas a lectores de pantalla (no el valor inicial). */}
      <span aria-live="polite" className="sr-only">{arrivals > 0 && count > 0 ? `Tenés ${count === 1 ? '1 notificación sin leer' : `${count} notificaciones sin leer`}` : ''}</span>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notificaciones recientes"
          className={cn('z-50 flex max-h-[min(34rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface text-foreground shadow-elevated motion-safe:animate-enter-from-below', panelPositions[tone])}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-base font-semibold">Notificaciones</p>
            {count > 0 && (
              <button type="button" onClick={markAll} disabled={marking} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50">
                <CheckCheck className="size-4" aria-hidden />
                {marking ? 'Marcando...' : 'Marcar todas como leídas'}
              </button>
            )}
          </div>
          {markError && <p role="alert" className="border-b border-border bg-danger-muted px-4 py-2 text-xs text-danger">{markError}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {panel.status === 'loading' && (
              <div className="flex flex-col gap-3 p-3" aria-busy="true" aria-label="Cargando notificaciones">
                {[0, 1, 2].map((row) => <div key={row} className="flex flex-col gap-1.5"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-4 w-full" /></div>)}
              </div>
            )}
            {panel.status === 'error' && (
              <p className="px-3 py-6 text-center text-sm text-foreground-secondary">
                No pudimos cargar las notificaciones.{' '}
                <button type="button" onClick={() => { setPanel({ status: 'loading' }); void load() }} className="font-semibold text-primary-600 hover:underline">Reintentar</button>
              </p>
            )}
            {panel.status === 'ready' && panel.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-100 text-primary-600"><BellOff className="size-5" aria-hidden /></span>
                <p className="text-sm font-semibold">No tenés notificaciones</p>
                <p className="text-xs text-foreground-secondary">Acá vas a ver las novedades de las solicitudes que te tocan.</p>
              </div>
            )}
            {panel.status === 'ready' && panel.items.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {panel.items.map((item) => <li key={item.id}><NotificationEntry item={item} time={formatRelativeTime(item.createdAt)} compact onOpen={() => setOpen(false)} /></li>)}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-1.5">
            <Link href="/notificaciones" onClick={() => setOpen(false)} className="flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
