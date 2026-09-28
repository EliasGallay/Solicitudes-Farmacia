'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/catalogos', label: 'Productos' },
  { href: '/catalogos/tipos', label: 'Tipos de producto' },
]

// Pestañas de la sección Catálogos (admin). Cada pestaña es una página: conservan URL y filtros propios.
export function CatalogTabs() {
  const pathname = usePathname()
  const current = pathname.startsWith('/catalogos/tipos') ? '/catalogos/tipos' : '/catalogos'

  return (
    <nav aria-label="Secciones de catálogos" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const active = tab.href === current
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn('-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm transition-colors focus-visible:rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500', active ? 'border-primary-600 font-semibold text-primary-700' : 'border-transparent font-medium text-foreground-secondary hover:border-border-strong hover:text-foreground')}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
