import Link from 'next/link'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { requestPasswordReset } from './actions'
import { AuthShell } from '../../components/auth/auth-shell'
import { RecoveryForm } from '../../components/auth/recovery-form'
import { FormError, FormSuccess } from '../../components/form-feedback'
import { feedbackMessage } from '../../lib/feedback'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RecoverPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams
  const sent = feedbackMessage(params.success)

  return (
    <AuthShell>
      <Card className="relative w-full max-w-lg shadow-elevated motion-safe:animate-enter-from-below motion-safe:[animation-delay:120ms]">
        <CardHeader className="flex-row items-start gap-3 p-6 pb-0 sm:items-center sm:gap-4 sm:p-8 sm:pb-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 sm:size-12">
            <KeyRound className="size-5 sm:size-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-2xl leading-8 tracking-tight">Recuperar contraseña</CardTitle>
            <CardDescription>Ingresá tu email y te enviaremos un enlace para crear una nueva.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          <FormError>{feedbackMessage(params.error)}</FormError>
          {/* Tras el envío se oculta el formulario para evitar reenvíos repetidos. */}
          {sent ? <FormSuccess>{sent}</FormSuccess> : <RecoveryForm action={requestPasswordReset} />}
          <Link href="/login" className={buttonVariants({ variant: 'ghost', className: 'mt-4 w-full' })}><ArrowLeft />Volver a iniciar sesión</Link>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
