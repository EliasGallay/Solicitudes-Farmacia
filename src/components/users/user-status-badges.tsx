import { Badge } from '@/components/ui/badge'

// Estado de la cuenta; "Contraseña temporal": todavía no la cambió desde que se la asignaron.
export function UserStatusBadges({ active, mustChangePassword }: { active: boolean; mustChangePassword: boolean }) {
  return (
    <>
      <Badge variant={active ? 'success' : 'neutral'}>{active ? 'Activo' : 'Inactivo'}</Badge>
      {active && mustChangePassword && <Badge variant="warning">Contraseña temporal</Badge>}
    </>
  )
}
