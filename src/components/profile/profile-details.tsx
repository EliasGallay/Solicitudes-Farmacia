'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { updateOwnProfile } from '@/app/profile-actions'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormField, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { initials, profileSchema, type ProfileValues } from '@/lib/users'

type ProfileDetailsProps = {
  fullName: string
  // null si no se pudo cargar.
  email: string | null
  roleLabel: string
  // Centro y rubros solo aplican al solicitante (undefined para el admin).
  centerName?: string
  areaNames?: string[]
}

const labelClasses = 'text-sm font-normal text-foreground-secondary'
const valueClasses = 'mt-1 break-words text-foreground'

// Resumen de identidad e información personal, en modo lectura por defecto.
// "Editar perfil" solo convierte en campo los datos que el usuario puede cambiar (el nombre);
// el resto lo administra un admin desde /usuarios y sigue como texto.
export function ProfileDetails({ fullName, email, roleLabel, centerName, areaNames }: ProfileDetailsProps) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { full_name: fullName } })
  const requester = centerName !== undefined

  // Al entrar a edición, foco en el campo; al salir, de vuelta en "Editar perfil".
  useEffect(() => {
    if (editing) form.setFocus('full_name')
    else if (returnFocus.current) editButtonRef.current?.focus()
    returnFocus.current = false
  }, [editing, form])

  function startEditing() {
    // Parte del nombre vigente (puede haber cambiado desde el primer render).
    form.reset({ full_name: fullName })
    setError(undefined)
    setEditing(true)
  }

  function stopEditing() {
    form.reset({ full_name: fullName })
    setError(undefined)
    returnFocus.current = true
    setEditing(false)
  }

  function onSubmit(values: ProfileValues) {
    setError(undefined)
    startTransition(async () => {
      const result = await updateOwnProfile(values)
      if (result?.error) return setError(result.error)
      // Sin error, la acción redirige con el aviso de éxito y el layout ya trae el nombre nuevo.
      returnFocus.current = true
      setEditing(false)
    })
  }

  return (
    <>
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-700">{initials(fullName)}</span>
          <div className="min-w-0">
            <p className="text-lg leading-7 font-semibold break-words text-foreground">{fullName}</p>
            {email && <p className="text-sm leading-5 break-all text-foreground-secondary">{email}</p>}
            <p className="text-sm leading-5 text-foreground-secondary">{[roleLabel, centerName].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {!editing && <button ref={editButtonRef} type="button" className={buttonVariants({ variant: 'secondary', className: 'max-sm:w-full' })} onClick={startEditing}><Pencil />Editar perfil</button>}
      </Card>

      <Card>
        <CardHeader><CardTitle>Información personal</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                <div>
                  {editing
                    ? (
                      <FormField control={form.control} name="full_name" render={({ field }) => (
                        <>
                          <dt><FormLabel htmlFor="perfil-nombre" className={labelClasses}>Nombre y apellido</FormLabel></dt>
                          <dd className="mt-2 space-y-2">
                            <Input id="perfil-nombre" {...field} maxLength={120} autoComplete="name" disabled={pending} />
                            <FormMessage />
                          </dd>
                        </>
                      )} />
                    )
                    : (
                      <>
                        <dt className={labelClasses}>Nombre y apellido</dt>
                        <dd className={valueClasses}>{fullName}</dd>
                      </>
                    )}
                </div>
                <div>
                  <dt className={labelClasses}>Email</dt>
                  <dd className={email ? `${valueClasses} break-all` : 'mt-1 text-foreground-secondary'}>{email ?? 'No se pudo cargar.'}</dd>
                </div>
                <div>
                  <dt className={labelClasses}>Rol</dt>
                  <dd className={valueClasses}>{roleLabel}</dd>
                </div>
                {requester && (
                  <div>
                    <dt className={labelClasses}>Centro de salud</dt>
                    <dd className={valueClasses}>{centerName || '—'}</dd>
                  </div>
                )}
                {requester && (
                  <div className="md:col-span-2">
                    <dt className={labelClasses}>Rubros habilitados</dt>
                    <dd className="mt-2">
                      {areaNames?.length
                        ? <ul className="flex flex-wrap gap-2">{areaNames.map((name) => <li key={name}><Badge>{name}</Badge></li>)}</ul>
                        : <span className="text-foreground">—</span>}
                    </dd>
                  </div>
                )}
              </dl>

              {error && <Alert variant="destructive" className="mt-5">{error}</Alert>}
              {editing && (
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={stopEditing} disabled={pending}>Cancelar</Button>
                  <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : 'Guardar cambios'}</Button>
                </div>
              )}
            </form>
          </Form>
          <p className="mt-6 border-t border-border pt-4 text-sm leading-5 text-foreground-secondary">
            Los datos de cuenta son administrados por el sistema. Contactá a un administrador para modificarlos.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
