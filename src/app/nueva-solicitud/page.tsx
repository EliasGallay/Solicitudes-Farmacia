import { redirect } from 'next/navigation'
import { AppShell } from '../../components/app-shell'
import { NewRequestForm } from '../../components/requests/new-request-form'
import { FormError, FormSuccess } from '../../components/form-feedback'
import { createRequest } from '../request-actions'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: centers }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, health_center_id, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, presentation').eq('active', true).order('name'),
    supabase.from('health_centers').select('id, name').eq('active', true).order('name'),
  ])
  if (profile?.must_change_password) redirect('/change-password')

  const params = await searchParams
  const availableCenters = profile?.role === 'admin'
    ? centers ?? []
    : (centers ?? []).filter((center) => center.id === profile?.health_center_id)

  return (
    <AppShell>
      <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
        <header className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold tracking-tight">Nueva solicitud</h1>
          <p className="mt-2 text-muted-foreground">Cargá los productos y cantidades que necesitás.</p>
        </header>
        <FormError>{params.error}</FormError>
        <FormSuccess>{params.success}</FormSuccess>
        <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <NewRequestForm action={createRequest} products={products ?? []} centers={availableCenters} />
        </section>
      </div>
    </AppShell>
  )
}
