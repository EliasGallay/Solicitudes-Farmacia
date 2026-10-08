'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { formatUnreadCount, NOTIFICATIONS_POLL_MS } from '@/lib/notifications'
import { cn } from '@/lib/utils'

// `arrivals` cuenta las veces que el contador subió durante la sesión: la campana lo usa para
// sacudirse solo cuando llega una notificación nueva (no al cargar ni al leer).
type CountState = { count: number; arrivals: number; setCount: (count: number) => void }

const NotificationCountContext = createContext<CountState>({ count: 0, arrivals: 0, setCount: () => {} })

// Contador de no leídas compartido por las campanas de desktop y mobile (notification-bell.tsx). El shell persiste entre
// navegaciones, así que se vuelve a consultar al cambiar de página, al volver a la pestaña y cada
// NOTIFICATIONS_POLL_MS mientras está visible.
export function NotificationCountProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [state, setState] = useState({ count: initialCount, arrivals: 0 })
  const pathname = usePathname()
  // El primer render ya trae el valor del servidor.
  const firstRun = useRef(true)

  const setCount = useCallback((count: number) => {
    setState((previous) => previous.count === count ? previous : { count, arrivals: count > previous.count ? previous.arrivals + 1 : previous.arrivals })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notificaciones/no-leidas', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as { count?: unknown }
      if (typeof data.count === 'number') setCount(data.count)
    } catch {
      // Sin red: se conserva el último valor conocido.
    }
  }, [setCount])

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    void refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible'
    const timer = window.setInterval(() => { if (visible()) void refresh() }, NOTIFICATIONS_POLL_MS)
    const onVisibility = () => { if (visible()) void refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  return <NotificationCountContext value={{ ...state, setCount }}>{children}</NotificationCountContext>
}

// Estado para la campana: contador, llegadas y cómo actualizar el contador.
export function useNotificationState() {
  return useContext(NotificationCountContext)
}

// La página de notificaciones informa el valor que acaba de leer (por ejemplo, después de
// "Marcar todas como leídas", que vuelve a la misma ruta).
export function SyncNotificationCount({ count }: { count: number }) {
  const { setCount } = useContext(NotificationCountContext)
  useEffect(() => { setCount(count) }, [count, setCount])
  return null
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-white tabular-nums', className)}>
      {formatUnreadCount(count)}
    </span>
  )
}
