import { ShoppingCart } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { vehicleRequestStatusLabels, type VehicleRequestStatus } from '@/lib/fleet'

// Mismos tonos que las solicitudes de insumos (src/components/status-badge.tsx).
const variants: Record<VehicleRequestStatus, NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  purchase: 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

const classes: Partial<Record<VehicleRequestStatus, string>> = {
  purchase: 'border border-warning',
  cancelled: 'border border-border-strong text-foreground',
}

export function VehicleRequestStatusBadge({ status }: { status: VehicleRequestStatus }) {
  return <Badge variant={variants[status]} className={classes[status]}>{status === 'purchase' && <ShoppingCart aria-hidden />}{vehicleRequestStatusLabels[status]}</Badge>
}
