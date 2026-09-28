'use client'

import { useEffect, useId, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const passwordFormSchema = z.object({
  password: z.string().min(8, 'Usá al menos 8 caracteres'),
  confirmation: z.string().min(8, 'Repetí la contraseña'),
}).refine((values) => values.password === values.confirmation, { path: ['confirmation'], message: 'Las contraseñas no coinciden' })
type PasswordFormValues = z.infer<typeof passwordFormSchema>
type PasswordAction = (formData: FormData) => Promise<void>

type PasswordFormProps = {
  action: PasswordAction
  // Dentro de una Card de otra página (/perfil): sin marco propio, campos en 2 columnas y
  // botón Cancelar. `onDone` se llama al cancelar o cuando la acción termina.
  embedded?: boolean
  onDone?: () => void
}

export function PasswordForm({ action, embedded = false, onDone }: PasswordFormProps) {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const form = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: { password: '', confirmation: '' } })

  useEffect(() => { if (embedded) form.setFocus('password') }, [embedded, form])

  function onSubmit(values: PasswordFormValues) {
    const formData = new FormData()
    formData.set('password', values.password)
    formData.set('confirmation', values.confirmation)
    if (!embedded) return startTransition(() => { void action(formData) })
    // La acción redirige con el resultado (?success= / ?error=), que muestra la página.
    startTransition(async () => {
      await action(formData)
      finish()
    })
  }

  function finish() {
    form.reset()
    onDone?.()
  }

  const fields = <>
    <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel htmlFor={`${id}-password`}>Nueva contraseña</FormLabel><FormControl><Input id={`${id}-password`} type="password" minLength={8} autoComplete="new-password" disabled={embedded && pending} {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="confirmation" render={({ field }) => <FormItem><FormLabel htmlFor={`${id}-confirmation`}>Repetir contraseña</FormLabel><FormControl><Input id={`${id}-confirmation`} type="password" minLength={8} autoComplete="new-password" disabled={embedded && pending} {...field} /></FormControl><FormMessage /></FormItem>} />
  </>

  if (!embedded) {
    return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
      {fields}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Guardando...' : 'Guardar contraseña'}</Button>
    </form></Form>
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
    <div className="grid items-start gap-4 sm:grid-cols-2">{fields}</div>
    <FormDescription>Mínimo 8 caracteres.</FormDescription>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" onClick={finish} disabled={pending}>Cancelar</Button>
      <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : 'Cambiar contraseña'}</Button>
    </div>
  </form></Form>
}
