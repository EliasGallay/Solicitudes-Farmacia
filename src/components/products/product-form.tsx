'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProductTypeOption } from '@/lib/product-types'
import { cn } from '@/lib/utils'

const productFormSchema = z.object({
  area: z.string({ required_error: 'Seleccioná un rubro' }).min(1, 'Seleccioná un rubro'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(150, 'Máximo 150 caracteres'),
  presentation: z.string().trim().min(1, 'La presentación es obligatoria').max(150, 'Máximo 150 caracteres'),
  product_type: z.string({ required_error: 'Seleccioná un tipo' }).min(1, 'Seleccioná un tipo'),
})

type ProductFormValues = z.infer<typeof productFormSchema>
type ProductFormDefaults = { area: string; name: string; presentation: string; product_type: string }
type ProductAction = (formData: FormData) => Promise<void>

// `areas`: rubros elegibles; con uno solo el selector no se muestra. `types`: tipos de todos los rubros.
// El selector de tipo depende del rubro elegido y ofrece los activos, más el actual del producto
// aunque esté inactivo. Cambiar de rubro limpia el tipo.
export function ProductForm({ action, areas, types, productId, defaultValues, submitLabel }: { action: ProductAction; areas: { key: string; name: string }[]; types: ProductTypeOption[]; productId?: string; defaultValues?: ProductFormDefaults; submitLabel: string }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: defaultValues ?? { area: areas.length === 1 ? areas[0].key : '', name: '', presentation: '', product_type: '' } })
  const area = form.watch('area')
  const typeOptions = types.filter((type) => type.area === area && (type.active || (type.area === defaultValues?.area && type.key === defaultValues.product_type)))
  const showArea = areas.length > 1

  function onSubmit(values: ProductFormValues) {
    const formData = new FormData()
    if (productId) formData.set('id', productId)
    formData.set('area', values.area)
    formData.set('name', values.name)
    formData.set('presentation', values.presentation)
    formData.set('product_type', values.product_type)
    startTransition(() => { void action(formData) })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={cn('grid gap-4 sm:grid-cols-2 sm:items-end', showArea ? 'lg:grid-cols-[10rem_1fr_1fr_12rem_auto]' : 'md:grid-cols-[1fr_1fr_12rem_auto]')}>
        {showArea && <FormField control={form.control} name="area" render={({ field }) => <FormItem><FormLabel>Rubro</FormLabel><Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue('product_type', '') }}><SelectTrigger aria-label="Rubro del producto"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{areas.map((option) => <SelectItem key={option.key} value={option.key}>{option.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />}
        <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} maxLength={150} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="presentation" render={({ field }) => <FormItem><FormLabel>Presentación</FormLabel><FormControl><Input {...field} maxLength={150} placeholder="unidad, caja, frasco..." /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="product_type" render={({ field }) => <FormItem><FormLabel>Tipo</FormLabel><Select value={field.value} onValueChange={field.onChange} disabled={!area}><SelectTrigger aria-label="Tipo de producto"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{typeOptions.map((type) => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : submitLabel}</Button>
      </form>
    </Form>
  )
}
