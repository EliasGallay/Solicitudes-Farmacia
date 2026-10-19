import { Clock, TriangleAlert } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { requestStatusLabels, type RequestStatus } from '@/lib/request-status'

// Única traducción entre estado funcional y representación visual.
const statusVariants: Record<RequestStatus, NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  partial: 'info',
  completed: 'primary',
  received: 'success',
  closed: 'neutral',
}

// "Cerrada" es neutral, pero el fondo gris solo casi no se distingue de la superficie: lleva borde y
// texto con contraste pleno.
const statusClasses: Partial<Record<RequestStatus, string>> = {
  closed: 'border border-border-strong text-foreground',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={statusVariants[status]} className={statusClasses[status]}>{requestStatusLabels[status]}</Badge>
}

// Señales de recepción que acompañan al estado en los listados.
export function ReceiptBadges({ unconfirmed, discrepancy }: { unconfirmed?: boolean; discrepancy?: boolean }) {
  return (
    <>
      {discrepancy && <Badge variant="warning"><TriangleAlert aria-hidden />Con diferencia</Badge>}
      {unconfirmed && <Badge variant="neutral"><Clock aria-hidden />Por confirmar</Badge>}
    </>
  )
}
