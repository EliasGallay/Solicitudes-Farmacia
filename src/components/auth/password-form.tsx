'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const passwordFormSchema = z.object({
  password: z.string().min(8, 'Usá al menos 8 caracteres'),
  confirmation: z.string().min(8, 'Repetí la contraseña'),
}).refine((values) => values.password === values.confirmation, { path: ['confirmation'], message: 'Las contraseñas no coinciden' })
type PasswordFormValues = z.infer<typeof passwordFormSchema>
type PasswordAction = (formData: FormData) => Promise<void>

export function PasswordForm({ action }: { action: PasswordAction }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: { password: '', confirmation: '' } })

  function onSubmit(values: PasswordFormValues) {
    const formData = new FormData()
    formData.set('password', values.password)
    formData.set('confirmation', values.confirmation)
    startTransition(() => { void action(formData) })
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
    <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Nueva contraseña</FormLabel><FormControl><Input type="password" minLength={8} autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="confirmation" render={({ field }) => <FormItem><FormLabel>Repetir contraseña</FormLabel><FormControl><Input type="password" minLength={8} autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>} />
    <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Guardando...' : 'Guardar contraseña'}</Button>
  </form></Form>
}
