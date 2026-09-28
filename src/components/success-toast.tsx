'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { showToast, type ToastOptions } from 'nextjs-toast-notify'
import { feedbackMessage } from '@/lib/feedback'

const TOAST_OPTIONS: ToastOptions = { duration: 5000, progress: true, position: 'top-right', transition: 'slideInUp', sound: false }

// Resultados exitosos que llegan por URL (?success=código, ver src/lib/feedback.ts): se muestran como
// toast y el parámetro se quita de la URL, para que no se repitan al recargar ni queden en el historial.
// Los errores (?error=) siguen mostrándose junto al formulario que los produjo.
export function SuccessToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const code = searchParams.get('success')
  // En desarrollo (Strict Mode) el efecto corre dos veces: evita el toast duplicado.
  const shown = useRef<string | null>(null)

  useEffect(() => {
    if (!code) {
      shown.current = null
      return
    }
    const key = `${pathname}?${searchParams}`
    if (shown.current === key) return
    shown.current = key

    const message = feedbackMessage(code)
    if (message) showToast.success(message, TOAST_OPTIONS)

    const params = new URLSearchParams(searchParams)
    params.delete('success')
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
  }, [code, pathname, router, searchParams])

  return null
}
