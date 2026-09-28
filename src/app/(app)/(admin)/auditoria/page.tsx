import { SectionPage } from '@/components/section-page'
import { requireRole } from '@/lib/session'

export default async function AuditPage() {
  await requireRole('admin')
  return <SectionPage title="Auditoría" description="El historial inmutable de operaciones se incorporará junto con los flujos de entregas." />
}
