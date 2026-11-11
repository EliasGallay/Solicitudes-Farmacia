import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { ErrorState } from '@/components/error-state'
import { VehicleForm } from '@/components/fleet/vehicle-form'
import { VehicleNotFound } from '@/components/fleet/vehicle-not-found'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { vehicleLabel } from '@/lib/fleet'
import { requireRole } from '@/lib/session'

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  if (!id.success) return <><BackButton fallback="/movilidad" /><VehicleNotFound /></>

  const { data: vehicle, error } = await supabase.from('vehicles').select('id, name, brand, model, year, plate, internal_code').eq('id', id.data).maybeSingle()
  if (error) return <><BackButton fallback="/movilidad" /><Card><ErrorState title="No pudimos cargar el vehículo" /></Card></>
  if (!vehicle) return <><BackButton fallback="/movilidad" /><VehicleNotFound /></>

  return (
    <>
      <BackButton fallback={`/movilidad/vehiculos/${id.data}`} />
      <PageHeader title="Editar vehículo" description={vehicleLabel({ name: vehicle.name as string, plate: vehicle.plate as string, internal_code: vehicle.internal_code as string | null })} />
      <Card>
        <CardContent className="pt-6">
          <VehicleForm
            vehicleId={id.data}
            defaultValues={{ name: vehicle.name as string, brand: vehicle.brand as string, model: vehicle.model as string, year: vehicle.year as number, plate: vehicle.plate as string, internal_code: (vehicle.internal_code as string | null) ?? '' }}
          />
        </CardContent>
      </Card>
    </>
  )
}
