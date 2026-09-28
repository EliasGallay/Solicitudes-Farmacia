'use client'

import { useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import { setTemporaryPassword } from '@/app/user-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateTemporaryPassword, passwordSchema } from '@/lib/users'

// Reemplaza la contraseña del usuario por una temporal que el admin le comparte.
export function TemporaryPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    setError(undefined)
    setConfirming(true)
  }

  // El diálogo queda abierto (y bloqueado) mientras se asigna.
  function confirm() {
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setConfirming(false)
    startTransition(async () => {
      const result = await setTemporaryPassword(userId, parsed.data)
      setConfirming(false)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit() }} className="flex flex-col gap-2">
      <Label htmlFor="password-temporal">Nueva contraseña temporal</Label>
      <div className="flex max-w-md flex-col gap-2 sm:flex-row">
        <Input id="password-temporal" type="text" autoComplete="off" spellCheck={false} className="font-mono" value={password} onChange={(event) => setPassword(event.target.value)} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => { setPassword(generateTemporaryPassword()); setError(undefined) }}><KeyRound />Generar</Button>
          <Button type="submit" className="flex-1" disabled={pending || !password}>{pending ? 'Guardando...' : 'Asignar'}</Button>
        </div>
      </div>
      {error && <Alert variant="destructive" className="mt-2">{error}</Alert>}
      <ConfirmDialog
        open={confirming}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
        tone="destructive"
        icon={KeyRound}
        title="Asignar contraseña temporal"
        description="La contraseña actual del usuario deja de funcionar. Va a tener que cambiar la temporal en su próximo ingreso."
        confirmLabel={pending ? 'Asignando...' : 'Asignar'}
      >
        <p className="rounded-md bg-surface-muted px-3 py-2 font-mono text-sm break-all">{password}</p>
      </ConfirmDialog>
    </form>
  )
}
