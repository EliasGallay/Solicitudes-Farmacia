import { FormError, FormSuccess } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { ProfileDetails } from '@/components/profile/profile-details'
import { SecuritySection } from '@/components/profile/security-section'
import { areaName, getAreas } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { requireSession } from '@/lib/session'
import { roleLabels } from '@/lib/users'

// Resultados de changeOwnPassword: se muestran dentro de la sección Seguridad.
const PASSWORD_FEEDBACK = new Set(['perfil-password', 'password-invalida', 'password-igual', 'password-debil', 'password-error'])

// Datos personales del usuario logueado, en modo lectura. Solo el nombre y la contraseña son
// editables: email, rol, centro y rubros los gestiona el administrador desde /usuarios.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { supabase, userId, fullName, role, centerName, areas: assignedAreas } = await requireSession()
  const feedback = await searchParams

  // Email: columna computada de supabase/migrations/202609300001_user_admin.sql (visible para uno mismo).
  const [{ data: profile, error }, areas] = await Promise.all([
    supabase.from('profiles').select('profile_email').eq('user_id', userId).maybeSingle(),
    getAreas(),
  ])
  const email = error ? null : ((profile?.profile_email as string | null | undefined) ?? null)
  const requester = role === 'requester'

  const passwordError = feedback.error && PASSWORD_FEEDBACK.has(feedback.error) ? feedback.error : undefined
  const passwordSuccess = feedback.success && PASSWORD_FEEDBACK.has(feedback.success) ? feedback.success : undefined
  const pageError = passwordError ? undefined : feedback.error
  const pageSuccess = passwordSuccess ? undefined : feedback.success

  return (
    <div className="max-w-6xl">
      <PageHeader title="Mi perfil" description="Consultá tus datos personales y la información de tu cuenta." />
      {(feedbackMessage(pageError) || feedbackMessage(pageSuccess)) && (
        <div className="-mt-4 mb-6">
          <FormError>{feedbackMessage(pageError)}</FormError>
          <FormSuccess>{feedbackMessage(pageSuccess)}</FormSuccess>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <ProfileDetails
          fullName={fullName}
          email={email}
          roleLabel={role ? roleLabels[role] : '—'}
          centerName={requester ? (centerName ?? '') : undefined}
          areaNames={requester ? assignedAreas.map((key) => areaName(areas ?? [], key)) : undefined}
        />
        <SecuritySection
          feedback={(passwordError || passwordSuccess) && (
            <>
              <FormError>{feedbackMessage(passwordError)}</FormError>
              <FormSuccess>{feedbackMessage(passwordSuccess)}</FormSuccess>
            </>
          )}
        />
      </div>
    </div>
  )
}
