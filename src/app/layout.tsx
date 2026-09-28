import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SuccessToast } from '@/components/success-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solicitudes de Insumos',
  description: 'Base técnica local — Secretaría de Salud',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        {/* useSearchParams necesita un límite de Suspense para no bloquear el render estático. */}
        <Suspense fallback={null}><SuccessToast /></Suspense>
      </body>
    </html>
  )
}
