import { BackButton } from '@/components/back-button'
import { PageHeader } from '@/components/page-header'
import { UserForm } from '@/components/users/user-form'
import { Card, CardContent } from '@/components/ui/card'
import { getAreas } from '@/lib/areas'
import { requireRole } from '@/lib/session'

export default async function NewUserPage() {
  const { supabase } = await requireRole('admin')
  const [{ data: centers }, areas] = await Promise.all([
    supabase.from('health_centers').select('id, name').eq('active', true).order('name'),
    getAreas(),
  ])

  return (
    <>
      <BackButton fallback="/usuarios" />
      <PageHeader title="Nuevo usuario" description="La cuenta queda activa con una contraseña temporal que el usuario cambia en su primer ingreso." />
      <Card>
        <CardContent className="pt-6">
          <UserForm centers={(centers ?? []) as { id: string; name: string }[]} areas={areas ?? []} />
        </CardContent>
      </Card>
    </>
  )
}
