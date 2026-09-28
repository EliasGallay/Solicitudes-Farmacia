'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dark = mounted && theme === 'dark'

  return (
    <button
      type="button"
      aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      role="switch"
      aria-checked={dark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn('flex h-11 w-full shrink-0 items-center justify-between gap-3 rounded-md px-4 text-base text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', className)}
    >
      <span className="flex items-center gap-3">
        {dark ? <Sun className="size-5 shrink-0" aria-hidden /> : <Moon className="size-5 shrink-0" aria-hidden />}
        {dark ? 'Modo claro' : 'Modo oscuro'}
      </span>
      <span aria-hidden className="flex h-6 w-11 shrink-0 items-center rounded-full border border-sidebar-muted/30 bg-sidebar-hover p-0.5">
        <span data-dark={dark} className={cn('theme-switch-thumb flex size-5 items-center justify-center rounded-full bg-sidebar-foreground text-sidebar')}>
          {dark ? <Sun className="size-3" /> : <Moon className="size-3" />}
        </span>
      </span>
    </button>
  )
}
