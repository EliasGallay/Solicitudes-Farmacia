'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const loginFormSchema = z.object({ email: z.string().email('Ingresá un email válido'), password: z.string().min(1, 'La contraseña es obligatoria') })
type LoginFormValues = z.infer<typeof loginFormSchema>
type LoginAction = (formData: FormData) => Promise<void>

export function LoginForm({ action }: { action: LoginAction }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })

  function onSubmit(values: LoginFormValues) {
    const formData = new FormData()
    formData.set('email', values.email)
    formData.set('password', values.password)
    startTransition(() => { void action(formData) })
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
    <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>} />
    <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Ingresando...' : 'Ingresar'}</Button>
  </form></Form>
}
