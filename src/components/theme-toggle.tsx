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
      // Interruptor con etiqueta fija: el estado lo indica aria-checked (y el switch), no el texto.
      aria-label="Modo oscuro"
      role="switch"
      aria-checked={dark}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn('flex h-10 w-full shrink-0 items-center justify-between gap-3 rounded-md px-3 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', className)}
    >
      <span className="flex items-center gap-3">
        <Moon className="size-4 shrink-0" aria-hidden />
        Modo oscuro
      </span>
      <span aria-hidden className="flex h-6 w-11 shrink-0 items-center rounded-full border border-sidebar-muted/30 bg-sidebar-hover p-0.5">
        <span data-dark={dark} className={cn('theme-switch-thumb flex size-5 items-center justify-center rounded-full bg-sidebar-foreground text-sidebar')}>
          {dark ? <Moon className="size-3" /> : <Sun className="size-3" />}
        </span>
      </span>
    </button>
  )
}
