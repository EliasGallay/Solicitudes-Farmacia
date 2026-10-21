import { Clock, ShoppingCart, TriangleAlert } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { requestStatusLabels, type RequestStatus } from '@/lib/request-status'

// Única traducción entre estado funcional y representación visual.
const statusVariants: Record<RequestStatus, NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  purchase: 'warning',
  partial: 'info',
  completed: 'primary',
  received: 'success',
  closed: 'neutral',
}

// "Cerrada" es neutral, pero el fondo gris solo casi no se distingue de la superficie: lleva borde y
// texto con contraste pleno. "En compras" sigue esperando como "Pendiente": mismo tono, con borde e
// ícono para distinguirlos.
const statusClasses: Partial<Record<RequestStatus, string>> = {
  closed: 'border border-border-strong text-foreground',
  purchase: 'border border-warning',
}

// `purchase`: tiene requerimiento de compra. Con entregas parciales el estado sigue siendo "Entrega
// parcial" y se suma "En compras" al lado: llegó una parte y el resto se pidió a compras.
export function StatusBadge({ status, purchase }: { status: RequestStatus; purchase?: boolean }) {
  const badge = <Badge variant={statusVariants[status]} className={statusClasses[status]}>{status === 'purchase' && <ShoppingCart aria-hidden />}{requestStatusLabels[status]}</Badge>
  if (!(purchase && status === 'partial')) return badge
  return <>{badge}<Badge variant={statusVariants.purchase} className={statusClasses.purchase}><ShoppingCart aria-hidden />{requestStatusLabels.purchase}</Badge></>
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
