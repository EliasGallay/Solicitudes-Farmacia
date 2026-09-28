'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150, 'Máximo 150 caracteres'),
  presentation: z.string().trim().min(1, 'La presentación es obligatoria').max(150, 'Máximo 150 caracteres'),
  product_type: z.string({ required_error: 'Seleccioná un tipo' }).min(1, 'Seleccioná un tipo'),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ProductFormDefaults = { name: string; presentation: string; product_type?: string }
type ProductAction = (formData: FormData) => Promise<void>

// `types`: tipos activos del rubro; un tipo inactivo solo se ofrece si es el actual del producto.
export function ProductForm({ action, types, productId, defaultValues, submitLabel }: { action: ProductAction; types: { key: string; label: string; active: boolean }[]; productId?: string; defaultValues?: ProductFormDefaults; submitLabel: string }) {
  const [pending, startTransition] = useTransition()
  const typeOptions = types.filter((type) => type.active || type.key === defaultValues?.product_type)
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: (defaultValues ?? { name: '', presentation: '' }) as ProductFormValues })

  function onSubmit(values: ProductFormValues) {
    const formData = new FormData()
    if (productId) formData.set('id', productId)
    formData.set('name', values.name)
    formData.set('presentation', values.presentation)
    formData.set('product_type', values.product_type)
    startTransition(() => { void action(formData) })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2 sm:items-end md:grid-cols-[1fr_1fr_12rem_auto]">
        <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} maxLength={150} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="presentation" render={({ field }) => <FormItem><FormLabel>Presentación</FormLabel><FormControl><Input {...field} maxLength={150} placeholder="unidad, caja, frasco..." /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="product_type" render={({ field }) => <FormItem><FormLabel>Tipo</FormLabel><Select value={field.value} onValueChange={field.onChange}><SelectTrigger aria-label="Tipo de producto"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{typeOptions.map((type) => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : submitLabel}</Button>
      </form>
    </Form>
  )
}
