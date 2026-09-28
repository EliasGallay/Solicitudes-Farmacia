import Link from 'next/link'
import { UserX } from 'lucide-react'
import { z } from 'zod'
import { deleteUser, toggleUserActive } from '@/app/user-actions'
import { BackButton } from '@/components/back-button'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError, FormSuccess } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { TemporaryPasswordForm } from '@/components/users/temporary-password-form'
import { UserForm } from '@/components/users/user-form'
import { UserStatusBadges } from '@/components/users/user-status-badges'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAreas } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { formatDateTime } from '@/lib/requests'
import { requireRole, type AppRole } from '@/lib/session'
import { roleLabels } from '@/lib/users'

export default async function UserDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase, userId: currentUserId } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const feedback = await searchParams
  if (!id.success) return <><BackButton fallback="/usuarios" /><NotFound /></>

  // Email, último ingreso y actividad: columnas computadas de supabase/migrations/202609300001_user_admin.sql.
  const [{ data: profile, error }, { data: centers }, areas] = await Promise.all([
    supabase.from('profiles').select('user_id, full_name, role, active, must_change_password, created_at, health_center_id, profile_email, profile_last_sign_in_at, profile_has_activity, profile_areas(area)').eq('user_id', id.data).maybeSingle(),
    supabase.from('health_centers').select('id, name, active').order('name'),
    getAreas(true),
  ])
  if (error) return <><BackButton fallback="/usuarios" /><Card><ErrorState title="No pudimos cargar el usuario" /></Card></>
  if (!profile) return <><BackButton fallback="/usuarios" /><NotFound /></>

  const isSelf = profile.user_id === currentUserId
  const active = profile.active as boolean
  const centerId = profile.health_center_id as string | null
  const assignedAreas = ((profile.profile_areas ?? []) as { area: string }[]).map((row) => row.area)
  // Centros y rubros inactivos solo se ofrecen si el usuario ya los tiene asignados.
  const centerOptions = ((centers ?? []) as { id: string; name: string; active: boolean }[]).filter((center) => center.active || center.id === centerId)
  const areaOptions = (areas ?? []).filter((area) => area.active || assignedAreas.includes(area.key))
  const lastSignIn = profile.profile_last_sign_in_at as string | null

  return (
    <>
      <BackButton fallback="/usuarios" />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{profile.full_name as string}{isSelf && <span className="text-base font-normal text-foreground-secondary">(vos)</span>}<UserStatusBadges active={active} mustChangePassword={profile.must_change_password as boolean} /></span>}
        description={`${roleLabels[profile.role as AppRole]} · Alta: ${formatDateTime(profile.created_at as string)} · Último ingreso: ${lastSignIn ? formatDateTime(lastSignIn) : 'nunca'}`}
      />
      {(feedback.error || feedback.success) && (
        <div className="-mt-4 mb-6">
          <FormError>{feedbackMessage(feedback.error)}</FormError>
          <FormSuccess>{feedbackMessage(feedback.success)}</FormSuccess>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Datos del usuario</CardTitle></CardHeader>
        <CardContent>
          <UserForm
            userId={profile.user_id as string}
            isSelf={isSelf}
            centers={centerOptions}
            areas={areaOptions}
            defaultValues={{ full_name: profile.full_name as string, email: (profile.profile_email as string | null) ?? '', role: profile.role as AppRole, health_center_id: centerId ?? undefined, areas: assignedAreas }}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>Asigná una contraseña temporal si el usuario la olvidó o no puede usar el enlace de recuperación. Tendrá que cambiarla al ingresar.</CardDescription>
        </CardHeader>
        <CardContent><TemporaryPasswordForm userId={profile.user_id as string} /></CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{active ? 'Desactivar usuario' : 'Reactivar usuario'}</CardTitle>
            <CardDescription>{active ? 'El usuario no podrá ingresar. Sus solicitudes y registros se conservan, y se puede reactivar en cualquier momento.' : 'El usuario vuelve a poder ingresar con su contraseña actual.'}</CardDescription>
          </CardHeader>
          <CardContent>
            {isSelf
              ? <p className="text-sm text-foreground-secondary">No podés desactivar tu propia cuenta.</p>
              : (
                <form action={toggleUserActive}>
                  <input type="hidden" name="id" value={profile.user_id as string} />
                  <input type="hidden" name="active" value={String(active)} />
                  <ConfirmSubmit variant={active ? 'destructive' : 'secondary'} message={active ? `¿Desactivar a ${profile.full_name}? No podrá ingresar al sistema.` : `¿Reactivar a ${profile.full_name}?`}>{active ? 'Desactivar' : 'Reactivar'}</ConfirmSubmit>
                </form>
              )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eliminar usuario</CardTitle>
            <CardDescription>Solo es posible si el usuario nunca hizo solicitudes ni registró entregas. Si tiene actividad, desactivalo.</CardDescription>
          </CardHeader>
          <CardContent>
            {isSelf
              ? <p className="text-sm text-foreground-secondary">No podés eliminar tu propia cuenta.</p>
              : profile.profile_has_activity
                ? <p className="text-sm text-foreground-secondary">Este usuario tiene actividad registrada: no se puede eliminar.</p>
                : (
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={profile.user_id as string} />
                    <ConfirmSubmit variant="destructive" message={`¿Eliminar definitivamente a ${profile.full_name}? Esta acción no se puede deshacer.`}>Eliminar</ConfirmSubmit>
                  </form>
                )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon={UserX} title="No encontramos el usuario" action={<Link href="/usuarios" className={buttonVariants({ variant: 'secondary' })}>Volver a usuarios</Link>}>
        Puede que haya sido eliminado.
      </EmptyState>
    </Card>
  )
}
