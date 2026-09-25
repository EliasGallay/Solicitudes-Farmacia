import { changePassword } from './actions'
import { logout } from '../login/actions'
import { PasswordForm } from '../../components/auth/password-form'
import { FormError } from '../../components/form-feedback'
import { feedbackMessage } from '../../lib/feedback'

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-2xl leading-8 font-bold tracking-tight text-foreground sm:text-3xl sm:leading-10">Cambiar contraseña</h1>
      <p className="mt-2 text-foreground-secondary">Por seguridad, definí una contraseña nueva antes de continuar.</p>
      <FormError>{feedbackMessage(params.error)}</FormError>
      <PasswordForm action={changePassword} />
      <form action={logout} className="mt-4 text-center">
        <button type="submit" className="text-sm text-foreground-secondary underline hover:text-foreground">Cerrar sesión y volver al login</button>
      </form>
    </main>
  )
}
