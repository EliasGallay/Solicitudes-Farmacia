import Link from 'next/link'
import { CarFront } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// Vehículo inexistente o id inválido en las pantallas de Movilidad.
export function VehicleNotFound() {
  return (
    <Card>
      <EmptyState icon={CarFront} title="No encontramos el vehículo" action={<Link href="/movilidad" className={buttonVariants({ variant: 'secondary' })}>Volver a Movilidad</Link>}>
        Puede que el enlace sea incorrecto.
      </EmptyState>
    </Card>
  )
}
