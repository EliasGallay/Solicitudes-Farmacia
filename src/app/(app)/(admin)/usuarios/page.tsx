import { SectionPage } from '@/components/section-page'
import { requireRole } from '@/lib/session'

export default async function UsersPage() {
  await requireRole('admin')
  return <SectionPage title="Usuarios" description="La administración de usuarios y perfiles estará disponible para administradores en una próxima etapa." />
}
