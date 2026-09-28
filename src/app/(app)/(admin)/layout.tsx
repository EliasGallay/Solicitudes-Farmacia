import type { ReactNode } from 'react'
import { requireRole } from '@/lib/session'

// Secciones exclusivas del administrador. Cada página vuelve a llamar a requireRole,
// porque los layouts no se re-renderizan al navegar.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole('admin')
  return children
}
