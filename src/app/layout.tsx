import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solicitudes de Farmacia',
  description: 'Base técnica local — Secretaría de Salud',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}
