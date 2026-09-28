'use client'

import { useState, useTransition } from 'react'
import { KeyRound } from 'lucide-react'
import { setTemporaryPassword } from '@/app/user-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateTemporaryPassword, passwordSchema } from '@/lib/users'

// Reemplaza la contraseña del usuario por una temporal que el admin le comparte.
export function TemporaryPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function submit() {
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    if (!window.confirm('La contraseña actual del usuario dejará de funcionar. ¿Continuar?')) return
    setError(undefined)
    startTransition(async () => {
      const result = await setTemporaryPassword(userId, parsed.data)
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
    </form>
  )
}
