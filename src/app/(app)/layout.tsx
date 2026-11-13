import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import { ListTransitionProvider } from '@/components/list-transition'
import { requireSession } from '@/lib/session'

// Shell compartido por todas las pantallas autenticadas: persiste entre navegaciones.
// Cada página vuelve a validar la sesión, porque los layouts no se re-renderizan al navegar.
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  await requireSession()
  return <ListTransitionProvider><AppShell>{children}</AppShell></ListTransitionProvider>
}
