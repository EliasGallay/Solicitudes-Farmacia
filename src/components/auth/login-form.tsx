'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
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
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })

  function onSubmit(values: LoginFormValues) {
    const formData = new FormData()
    formData.set('email', values.email)
    formData.set('password', values.password)
    startTransition(() => { void action(formData) })
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
    <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel htmlFor="login-email">Email</FormLabel><FormControl><Input id="login-email" type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="password" render={({ field }) => <FormItem><div className="flex items-center justify-between gap-3"><FormLabel htmlFor="login-password">Contraseña</FormLabel><Link href="/recuperar-contrasena" className="rounded-sm text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">¿Olvidaste tu contraseña?</Link></div><FormControl>
      <div className="relative">
        <Input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-11" {...field} />
        <Button type="button" variant="ghost" size="icon-sm" className="absolute top-0.5 right-0.5 text-foreground-secondary hover:text-primary-600" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </FormControl><FormMessage /></FormItem>} />
    <Button type="submit" size="lg" className="group mt-2 w-full" disabled={pending}>
      {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />Ingresando...</> : <>Ingresar<ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.75 motion-reduce:transition-none" aria-hidden /></>}
    </Button>
  </form></Form>
}
