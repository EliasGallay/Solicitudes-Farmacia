'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Estándar de filtros: el estado vive en la URL y el servidor resuelve la consulta filtrada.
// Cambiar un filtro reinicia la paginación.
export function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const navigate = useCallback((params: URLSearchParams) => {
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }))
  }, [pathname, router])

  const setFilters = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!('page' in updates)) params.delete('page')
    navigate(params)
  }, [navigate, searchParams])

  const clearFilters = useCallback(() => navigate(new URLSearchParams()), [navigate])

  return { setFilters, clearFilters, pending }
}

// Búsqueda de texto: se edita localmente y se aplica a la URL tras `delay` ms sin escribir.
export function useSearchFilter(key: string, current: string | undefined, delay = 300) {
  const { setFilters, pending } = useUrlFilters()
  const [value, setValue] = useState(current ?? '')
  const skipNext = useRef(false)

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false
      return
    }
    const term = value.trim()
    if (term === (current ?? '')) return
    const timeout = setTimeout(() => setFilters({ [key]: term || undefined }), delay)
    return () => clearTimeout(timeout)
  }, [current, delay, key, setFilters, value])

  // Vacía el campo sin programar una navegación (para usar junto con clearFilters).
  const reset = useCallback(() => {
    if (value === '') return
    skipNext.current = true
    setValue('')
  }, [value])

  return { value, setValue, reset, pending }
}
