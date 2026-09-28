import { cache } from 'react'
import { redirect } from 'next/navigation'
import { withFeedback } from './feedback'
import { relationOne } from './requests'
import { createSupabaseServerClient } from './supabase/server'

export type AppRole = 'admin' | 'requester'

// Clave de public.areas ('pharmacy', 'cleaning', ...). Los rubros son datos: no hay lista fija en el código.
export type AreaKey = string

// Cached per request: pages and AppShell share one profile lookup.
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Perfil, centro y rubros en una sola consulta (relaciones embebidas).
  const { data: profile } = await supabase.from('profiles').select('full_name, role, active, health_center_id, must_change_password, health_center:health_centers(name), profile_areas(area)').eq('user_id', user.id).maybeSingle()
  const center = relationOne(profile?.health_center as { name: string } | { name: string }[] | null | undefined)
  // Un perfil inactivo no tiene rol, igual que current_app_role() en la base.
  const role = profile?.active ? (profile.role as AppRole) : null

  return {
    supabase,
    userId: user.id,
    fullName: (profile?.full_name as string | undefined) ?? user.email ?? '',
    role,
    // Rubros asignados al solicitante. Vacío para el admin, que accede a todos por su rol.
    areas: role === 'requester' ? ((profile?.profile_areas ?? []) as { area: AreaKey }[]).map((row) => row.area) : [],
    healthCenterId: (profile?.health_center_id as string | null | undefined) ?? null,
    centerName: (center?.name as string | undefined) ?? null,
    mustChangePassword: Boolean(profile?.must_change_password),
  }
})

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
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

// Guard de rubro: el admin pasa siempre; el solicitante, solo con el rubro asignado.
// La base aplica la misma regla con has_area().
export async function requireArea(area: AreaKey) {
  const session = await requireSession()
  if (session.role !== 'admin' && !session.areas.includes(area)) redirect(withFeedback('/', 'error', 'sin-rubro'))
  return session
}
