import { BackButton } from '@/components/back-button'
import { VehicleForm } from '@/components/fleet/vehicle-form'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requireRole } from '@/lib/session'

export default async function NewVehiclePage() {
  await requireRole('admin')
  return (
    <>
      <BackButton fallback="/movilidad" />
      <PageHeader title="Nuevo vehículo" description="Queda disponible para cargar su historial y pedir reparaciones." />
      <Card><CardContent className="pt-6"><VehicleForm /></CardContent></Card>
    </>
  )
}
