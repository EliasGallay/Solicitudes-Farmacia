import { Building2, Car, CirclePlus, ClipboardList, FileText, House, Package, PackageCheck, Truck, Users, type LucideIcon } from 'lucide-react'

// Menú lateral (src/components/sidebar.tsx).
// `estado`: el ítem apunta al listado de solicitudes filtrado (?estado=); `count`: indicador a la derecha.
// `tour`: data-tour del ítem, para los recorridos por pantalla (src/lib/tours.ts).
export type NavItem = { label: string; icon: LucideIcon; href: string; estado?: string; count?: number; tour?: string }

// Qué módulos usa el solicitante: insumos (algún rubro 'supplies') y Movilidad (rubro 'fleet').
export type NavAccess = { supplies: boolean; fleet: boolean }

const suppliesNavigation: NavItem[] = [
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  // Acceso directo a lo que el centro tiene que confirmar, sin pasar por filtros ni notificaciones.
  { href: '/solicitudes?estado=por_confirmar', estado: 'por_confirmar', label: 'Por confirmar', icon: PackageCheck, tour: 'nav-pending-receipts' },
  { href: '/solicitudes/nueva', label: 'Nueva solicitud', icon: CirclePlus },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
]

const fleetItem: NavItem = { href: '/movilidad', label: 'Movilidad', icon: Car }

export function requesterNavigation(access: NavAccess): NavItem[] {
  return [
    { href: '/', label: 'Inicio', icon: House },
    ...(access.supplies ? suppliesNavigation : []),
    ...(access.fleet ? [fleetItem] : []),
  ]
}

// "Nueva solicitud" está oculta para el admin por ahora; la ruta sigue disponible.
export const adminNavigation: NavItem[] = [
  { href: '/', label: 'Panel', icon: House },
  { href: '/solicitudes', label: 'Solicitudes', icon: FileText },
  { href: '/entregas', label: 'Entregas', icon: Truck },
  fleetItem,
  { href: '/catalogos', label: 'Catálogos', icon: Package },
  { href: '/usuarios', label: 'Usuarios', icon: Users },
  { href: '/centros', label: 'Centros', icon: Building2 },
  { href: '/auditoria', label: 'Auditoría', icon: ClipboardList },
]
