import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { requireSession } from '@/lib/session'

// Shell compartido por todas las pantallas autenticadas: persiste entre navegaciones.
// Cada página vuelve a validar la sesión, porque los layouts no se re-renderizan al navegar.
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireSession()
  return <AppShell>{children}</AppShell>
}
