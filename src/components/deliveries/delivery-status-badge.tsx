import { Badge } from '@/components/ui/badge'
import type { ReceiptState } from '@/lib/deliveries'

export function DeliveryStatusBadge({ voided }: { voided: boolean }) {
  return voided ? <Badge variant="danger">Anulada</Badge> : <Badge variant="success">Entregada</Badge>
}

const receiptBadges: Record<ReceiptState, { label: string; variant: 'neutral' | 'info' | 'danger' | 'success' }> = {
  sin_confirmar: { label: 'Sin confirmar', variant: 'neutral' },
  parcial: { label: 'Confirmada en parte', variant: 'info' },
  con_diferencia: { label: 'Con diferencia', variant: 'danger' },
  recibida: { label: 'Recibida', variant: 'success' },
}

// Estado de la recepción de un remito por parte del centro.
export function ReceiptStateBadge({ state }: { state: ReceiptState }) {
  const badge = receiptBadges[state]
  return <Badge variant={badge.variant}>{badge.label}</Badge>
}
