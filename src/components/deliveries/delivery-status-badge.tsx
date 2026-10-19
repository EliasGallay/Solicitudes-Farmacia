import { CircleCheck, Clock, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ReceiptState } from '@/lib/deliveries'

export function DeliveryStatusBadge({ voided }: { voided: boolean }) {
  return voided ? <Badge variant="danger">Anulada</Badge> : <Badge variant="success">Entregada</Badge>
}

// Mismo criterio que la confirmación de recepción: conforme en verde con check, diferencia en ámbar
// con alerta (requiere revisión, no es un error).
const receiptBadges: Record<ReceiptState, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success'; icon?: LucideIcon }> = {
  sin_confirmar: { label: 'Sin confirmar', variant: 'neutral', icon: Clock },
  parcial: { label: 'Confirmada en parte', variant: 'info' },
  con_diferencia: { label: 'Con diferencia', variant: 'warning', icon: TriangleAlert },
  recibida: { label: 'Recibida', variant: 'success', icon: CircleCheck },
}

// Estado de la recepción de un remito por parte del centro.
export function ReceiptStateBadge({ state }: { state: ReceiptState }) {
  const badge = receiptBadges[state]
  return <Badge variant={badge.variant}>{badge.icon && <badge.icon aria-hidden />}{badge.label}</Badge>
}
