import { Badge } from '@/components/ui/badge'

export function ProductStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'neutral'}>{active ? 'Activo' : 'Inactivo'}</Badge>
}
