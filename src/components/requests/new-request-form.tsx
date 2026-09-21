'use client'

import { useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const requestFormSchema = z.object({
  health_center_id: z.string().uuid('Seleccioná un centro de salud'),
  quantities: z.record(z.number().int('Usá cantidades enteras').min(0, 'La cantidad no puede ser negativa')),
})

type RequestFormValues = z.infer<typeof requestFormSchema>
type RequestAction = (formData: FormData) => Promise<void>
type Product = { id: string; name: string; presentation: string }
type Center = { id: string; name: string }

export function NewRequestForm({ action, products, centers }: { action: RequestAction; products: Product[]; centers: Center[] }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: { health_center_id: '', quantities: Object.fromEntries(products.map((product) => [product.id, 0])) },
  })
  const quantities = useWatch({ control: form.control, name: 'quantities' })
  const selectedProducts = products.filter((product) => (quantities?.[product.id] ?? 0) > 0)

  function onSubmit(values: RequestFormValues) {
    const formData = new FormData()
    formData.set('health_center_id', values.health_center_id)
    Object.entries(values.quantities).forEach(([productId, quantity]) => formData.set(`quantity_${productId}`, String(quantity)))
    startTransition(() => { void action(formData) })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField control={form.control} name="health_center_id" render={({ field }) => <FormItem className="max-w-md"><FormLabel>Centro de salud</FormLabel><FormControl><select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Seleccionar centro</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></FormControl><FormMessage /></FormItem>} />
        <div className="grid gap-3 md:grid-cols-2">
          {products.map((product) => (
            <FormField key={product.id} control={form.control} name={`quantities.${product.id}` as `quantities.${string}`} render={({ field }) => <FormItem className="flex items-center justify-between gap-4 rounded-md border border-border p-3"><div><FormLabel>{product.name}</FormLabel><p className="text-sm text-muted-foreground">{product.presentation}</p></div><FormControl><Input type="number" min="0" step="1" className="w-24 text-right" {...field} onChange={(event) => field.onChange(event.target.valueAsNumber || 0)} /></FormControl><FormMessage /></FormItem>} />
          ))}
        </div>
        <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Seleccionados: </span>
          {selectedProducts.length === 0 ? 'ningún producto' : selectedProducts.map((product) => `${product.name} (${quantities?.[product.id]})`).join(', ')}
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Creando...' : 'Crear solicitud'}</Button>
      </form>
    </Form>
  )
}
