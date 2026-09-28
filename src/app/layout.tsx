import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SuccessToast } from '@/components/success-toast'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solicitudes de Insumos',
  description: 'Base técnica local — Secretaría de Salud',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
        {/* useSearchParams necesita un límite de Suspense para no bloquear el render estático. */}
          <Suspense fallback={null}><SuccessToast /></Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
