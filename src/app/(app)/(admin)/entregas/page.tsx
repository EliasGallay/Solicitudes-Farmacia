import { SectionPage } from '@/components/section-page'
import { requireRole } from '@/lib/session'

export default async function DeliveriesPage() {
  await requireRole('admin')
  return <SectionPage title="Entregas" description="El registro de entregas parciales y totales se habilitará en la próxima etapa." />
}
