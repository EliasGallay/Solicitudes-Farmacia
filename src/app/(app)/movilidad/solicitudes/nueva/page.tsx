import Link from 'next/link'
import { Car, Plus } from 'lucide-react'
import { z } from 'zod'
import { BackButton } from '@/components/back-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { VehicleRequestForm } from '@/components/fleet/vehicle-request-form'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { vehicleLabel } from '@/lib/fleet'
import { requireFleetAccess } from '@/lib/session'

// ?vehiculo=<id>: llega desde la ficha del vehículo con el vehículo ya elegido.
export default async function NewVehicleRequestPage({ searchParams }: { searchParams: Promise<{ vehiculo?: string }> }) {
  const { supabase, role } = await requireFleetAccess()
  const preselected = z.string().uuid().optional().catch(undefined).parse((await searchParams).vehiculo)
  const { data, error } = await supabase.from('vehicles').select('id, name, plate, internal_code').eq('active', true).order('internal_code', { nullsFirst: false }).order('name')
  const vehicles = (data ?? []).map((vehicle) => ({ id: vehicle.id as string, label: vehicleLabel(vehicle as { name: string; plate: string; internal_code: string | null }) }))

  return (
    <>
      <BackButton fallback="/movilidad" />
      <PageHeader title="Pedir reparación" description="La solicitud le llega al administrador, que la revisa y la pide a compras si hace falta." />
      <Card>
        {error ? <ErrorState title="No pudimos cargar los vehículos" />
          : vehicles.length === 0 ? (
            <EmptyState icon={Car} title="No hay vehículos activos" action={role === 'admin' ? <Link href="/movilidad/vehiculos/nuevo" className={buttonVariants()}><Plus />Nuevo vehículo</Link> : undefined}>
              {role === 'admin' ? 'Cargá un vehículo para poder pedir reparaciones.' : 'El administrador tiene que cargar los vehículos de la flota.'}
            </EmptyState>
          ) : <CardContent className="pt-6"><VehicleRequestForm vehicles={vehicles} vehicleId={vehicles.some((vehicle) => vehicle.id === preselected) ? preselected : undefined} /></CardContent>}
      </Card>
    </>
  )
}
