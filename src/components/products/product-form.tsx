'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150, 'Máximo 150 caracteres'),
  presentation: z.string().trim().min(1, 'La presentación es obligatoria').max(150, 'Máximo 150 caracteres'),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ProductAction = (formData: FormData) => Promise<void>

export function ProductForm({ action, productId, defaultValues, submitLabel }: { action: ProductAction; productId?: string; defaultValues?: ProductFormValues; submitLabel: string }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: defaultValues ?? { name: '', presentation: '' } })

  function onSubmit(values: ProductFormValues) {
    const formData = new FormData()
    if (productId) formData.set('id', productId)
    formData.set('name', values.name)
    formData.set('presentation', values.presentation)
    startTransition(() => { void action(formData) })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} maxLength={150} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="presentation" render={({ field }) => <FormItem><FormLabel>Presentación</FormLabel><FormControl><Input {...field} maxLength={150} placeholder="unidad, caja, frasco..." /></FormControl><FormMessage /></FormItem>} />
        <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : submitLabel}</Button>
      </form>
    </Form>
  )
}
