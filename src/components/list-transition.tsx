'use client'

import { createContext, useContext, useTransition, type ComponentProps, type MouseEvent, type ReactNode, type TransitionStartFunction } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type ListTransition = { pending: boolean; startTransition: TransitionStartFunction }

const ListTransitionContext = createContext<ListTransition | null>(null)

// Transición compartida de los listados: filtros, filas por página y paginación navegan dentro de
// ella, así el listado anterior queda visible (atenuado) mientras el servidor resuelve el nuevo,
// en lugar de reemplazarse por el skeleton.
export function ListTransitionProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition()
  return <ListTransitionContext.Provider value={{ pending, startTransition }}>{children}</ListTransitionContext.Provider>
}

// Transición compartida si hay provider; si no, una propia del componente.
export function useListTransition(): ListTransition {
  const shared = useContext(ListTransitionContext)
  const [pending, startTransition] = useTransition()
  return shared ?? { pending, startTransition }
}

// Contenedor del listado: se atenúa mientras se carga el siguiente. El retraso evita el parpadeo
// cuando la respuesta es inmediata.
export function ListPending({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useListTransition()
  return (
    <div aria-busy={pending} className={cn('motion-safe:transition-opacity', pending && 'pointer-events-none opacity-60 motion-safe:delay-150', className)}>
      {children}
    </div>
  )
}

// Link que navega dentro de la transición del listado (paginación). Con teclas modificadoras o
// botón del medio se comporta como un link común (abrir en otra pestaña).
export function ListLink({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const router = useRouter()
  const { startTransition } = useListTransition()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    startTransition(() => router.push(href))
  }

  return <Link href={href} onClick={handleClick} {...props} />
}
