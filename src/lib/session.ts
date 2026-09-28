import { cache } from 'react'
import { redirect } from 'next/navigation'
import { withFeedback } from './feedback'
import { relationOne } from './requests'
import { createSupabaseServerClient } from './supabase/server'

export type AppRole = 'admin' | 'requester'

// Cached per request: pages and AppShell share one profile lookup.
export const getSession = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Perfil y centro en una sola consulta (relación embebida).
  const { data: profile } = await supabase.from('profiles').select('full_name, role, active, health_center_id, must_change_password, health_center:health_centers(name)').eq('user_id', user.id).maybeSingle()
  const center = relationOne(profile?.health_center as { name: string } | { name: string }[] | null | undefined)

  return {
    supabase,
    userId: user.id,
    fullName: (profile?.full_name as string | undefined) ?? user.email ?? '',
    // Un perfil inactivo no tiene rol, igual que current_app_role() en la base.
    role: profile?.active ? (profile.role as AppRole) : null,
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
