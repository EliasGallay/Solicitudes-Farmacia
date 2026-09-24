import { changePassword } from './actions'
import { logout } from '../login/actions'
import { PasswordForm } from '../../components/auth/password-form'
import { FormError } from '../../components/form-feedback'
import { feedbackMessage } from '../../lib/feedback'

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Cambiar contraseña</h1>
      <p className="mt-2 text-muted-foreground">Por seguridad, definí una contraseña nueva antes de continuar.</p>
      <FormError>{feedbackMessage(params.error)}</FormError>
      <PasswordForm action={changePassword} />
      <form action={logout} className="mt-4 text-center">
        <button type="submit" className="text-sm text-muted-foreground underline hover:text-foreground">Cerrar sesión y volver al login</button>
      </form>
    </main>
  )
}
