import { LogIn } from 'lucide-react'
import { login } from './actions'
import { AuthShell } from '../../components/auth/auth-shell'
import { LoginForm } from '../../components/auth/login-form'
import { FormError } from '../../components/form-feedback'
import { feedbackMessage } from '../../lib/feedback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <AuthShell>
      <Card className="relative w-full max-w-lg shadow-elevated motion-safe:animate-enter-from-below motion-safe:[animation-delay:120ms]">
        {/* Encabezado compacto: ícono de acceso a la izquierda, título y subtítulo a la derecha. */}
        <CardHeader className="flex-row items-start gap-3 p-6 pb-0 sm:items-center sm:gap-4 sm:p-8 sm:pb-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 sm:size-12">
            <LogIn className="size-5 sm:size-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-2xl leading-8 tracking-tight">Iniciar sesión</CardTitle>
            <CardDescription>Accedé con tus credenciales para continuar.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          <FormError>{feedbackMessage(params.error)}</FormError>
          <LoginForm action={login} />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
