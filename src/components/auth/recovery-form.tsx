'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const recoveryFormSchema = z.object({ email: z.string().trim().email('Ingresá un email válido') })
type RecoveryFormValues = z.infer<typeof recoveryFormSchema>
type RecoveryAction = (formData: FormData) => Promise<void>

export function RecoveryForm({ action }: { action: RecoveryAction }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<RecoveryFormValues>({ resolver: zodResolver(recoveryFormSchema), defaultValues: { email: '' } })

  function onSubmit(values: RecoveryFormValues) {
    const formData = new FormData()
    formData.set('email', values.email)
    startTransition(() => { void action(formData) })
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5">
    <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel htmlFor="recuperar-email">Email</FormLabel><FormControl><Input id="recuperar-email" type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>} />
    <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
      {pending ? <><LoaderCircle className="motion-safe:animate-spin" aria-hidden />Enviando...</> : <>Enviar enlace<Send aria-hidden /></>}
    </Button>
  </form></Form>
}
