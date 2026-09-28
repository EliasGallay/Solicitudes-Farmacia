'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyRound } from 'lucide-react'
import { changeOwnPassword } from '@/app/profile-actions'
import { PasswordForm } from '@/components/auth/password-form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Contraseña en modo lectura; "Cambiar contraseña" abre el formulario en la misma card.
// `feedback`: resultado del último cambio (llega por URL), junto a la sección y no arriba de
// la página, porque tras la acción la página no se desplaza.
export function SecuritySection({ feedback }: { feedback?: ReactNode }) {
  const [changing, setChanging] = useState(false)
  const changeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (!changing && returnFocus.current) changeButtonRef.current?.focus()
    returnFocus.current = false
  }, [changing])

  function close() {
    returnFocus.current = true
    setChanging(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Seguridad</CardTitle></CardHeader>
      <CardContent>
        {changing
          ? (
            <>
              <h3 className="mb-4 text-base leading-6 font-semibold text-foreground">Cambiar contraseña</h3>
              <PasswordForm action={changeOwnPassword} embedded onDone={close} />
            </>
          )
          : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm leading-5 text-foreground-secondary">Contraseña</p>
                {/* Solo representación visual: la contraseña nunca se lee ni se muestra. */}
                <p aria-hidden className="mt-1 tracking-widest text-foreground">••••••••••</p>
                <p className="mt-1 text-sm leading-5 text-foreground-secondary">Podés actualizar tu contraseña de acceso.</p>
              </div>
              <button ref={changeButtonRef} type="button" className={buttonVariants({ variant: 'secondary', className: 'max-sm:w-full' })} onClick={() => setChanging(true)}>
                <KeyRound />Cambiar contraseña
              </button>
            </div>
          )}
        {feedback}
      </CardContent>
    </Card>
  )
}
