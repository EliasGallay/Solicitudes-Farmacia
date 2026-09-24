import { Badge, type BadgeProps } from '@/components/ui/badge'
import { requestStatusLabels, type RequestStatus } from '@/lib/request-status'

// Única traducción entre estado funcional y representación visual.
const statusVariants: Record<RequestStatus, NonNullable<BadgeProps['variant']>> = {
  pending: 'warning',
  partial: 'info',
  completed: 'success',
  closed: 'neutral',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={statusVariants[status]}>{requestStatusLabels[status]}</Badge>
}
