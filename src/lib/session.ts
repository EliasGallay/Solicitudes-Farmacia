import { cache } from 'react'
import { redirect } from 'next/navigation'
import { splitAreas } from './fleet'
import { withFeedback } from './feedback'
import { relationOne } from './requests'
import { createSupabaseServerClient } from './supabase/server'

// purchasing (Compras): sin centro ni rubros; ve las solicitudes con requerimiento de compra y comenta.
export type AppRole = 'admin' | 'requester' | 'purchasing'

// Clave de public.areas ('pharmacy', 'cleaning', ...). Los rubros son datos: no hay lista fija en el código.
export type AreaKey = string

// Cached per request: pages and AppShell share one profile lookup.
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  // JWT validado localmente (ver middleware): la base es la autoridad y aplica RLS con el mismo token.
  const { data: auth } = await supabase.auth.getClaims()
  const claims = auth?.claims
  if (!claims?.sub) return null
  const user = { id: claims.sub, email: claims.email }

  // Perfil, centro y rubros en una sola consulta (relaciones embebidas).
  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name, role, active, health_center_id, must_change_password, health_center:health_centers(name), profile_areas(area, area_info:areas(kind))').eq('user_id', user.id).maybeSingle()
  // Sin perfil el usuario queda sin rol; un error acá suele ser una migración sin aplicar (p. ej. areas.kind).
  if (profileError) console.error('Error al cargar el perfil de la sesión', profileError)
  const center = relationOne(profile?.health_center as { name: string } | { name: string }[] | null | undefined)
  // Un perfil inactivo no tiene rol, igual que current_app_role() en la base.
  const role = profile?.active ? (profile.role as AppRole) : null
  // Rubros asignados al solicitante, separando Movilidad (kind 'fleet') de los de insumos.
  const assigned = splitAreas(((profile?.profile_areas ?? []) as { area: AreaKey; area_info: { kind: string } | { kind: string }[] | null }[])
    .map((row) => ({ area: row.area, kind: relationOne(row.area_info)?.kind ?? 'supplies' })))

  return {
    supabase,
    userId: user.id,
    fullName: (profile?.full_name as string | undefined) ?? user.email ?? '',
    role,
    // Rubros de insumos asignados al solicitante. Vacío para el admin, que accede a todos por su rol.
    areas: role === 'requester' ? assigned.areas : [],
    // Acceso al módulo Movilidad: el admin siempre; el solicitante, con el rubro 'fleet'.
    fleetAccess: role === 'admin' || (role === 'requester' && assigned.fleetAccess),
    healthCenterId: (profile?.health_center_id as string | null | undefined) ?? null,
    centerName: (center?.name as string | undefined) ?? null,
    mustChangePassword: Boolean(profile?.must_change_password),
  }
})

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Sin rol: perfil inactivo o inexistente. La base ya le niega todo (current_app_role()); se cierra la sesión.
  if (!session.role) redirect('/auth/salir')
  if (session.mustChangePassword) redirect('/change-password')
  return session
}

// Guard de rol para páginas y server actions. Se llama en cada página además del layout,
// porque los layouts no se re-renderizan al navegar.
export async function requireRole(role: AppRole) {
  const session = await requireSession()
  if (session.role !== role) redirect(withFeedback('/', 'error', 'solo-admin'))
  return session
}

// Guard del módulo Movilidad: el admin o un solicitante con el rubro 'fleet' (has_area('fleet') en la base).
export async function requireFleetAccess() {
  const session = await requireSession()
  if (!session.fleetAccess) redirect(withFeedback('/', 'error', 'sin-rubro'))
  return session
}

// Guard de rubro: el admin pasa siempre; el solicitante, solo con el rubro asignado.
// La base aplica la misma regla con has_area().
export async function requireArea(area: AreaKey) {
  const session = await requireSession()
  if (session.role !== 'admin' && !session.areas.includes(area)) redirect(withFeedback('/', 'error', 'sin-rubro'))
  return session
}
