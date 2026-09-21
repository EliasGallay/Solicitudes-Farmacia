import { login } from './actions'
import { LoginForm } from '../../components/auth/login-form'
import { FormError } from '../../components/form-feedback'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <span className="mb-4 w-fit rounded-full bg-secondary px-3 py-1 text-sm font-medium">Solicitudes de Farmacia</span>
      <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-muted-foreground">Ingresá con tu usuario habilitado.</p>
      <FormError>{params.error}</FormError>
      <LoginForm action={login} />
    </main>
  )
}
