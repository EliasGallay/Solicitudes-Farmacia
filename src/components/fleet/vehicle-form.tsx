'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createVehicle, updateVehicle } from '@/app/fleet-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { INTERNAL_CODE_MAX, VEHICLE_TEXT_MAX, vehicleSchema, type VehicleInput, type VehicleValues } from '@/lib/fleet'

const EMPTY: VehicleInput = { name: '', brand: '', model: '', year: new Date().getFullYear(), plate: '', internal_code: '' }

// Alta (sin `vehicleId`) o edición de un vehículo (solo admin).
export function VehicleForm({ vehicleId, defaultValues }: { vehicleId?: string; defaultValues?: VehicleInput }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const form = useForm<VehicleInput, unknown, VehicleValues>({ resolver: zodResolver(vehicleSchema), defaultValues: defaultValues ?? EMPTY })

  function onSubmit(values: VehicleValues) {
    setError(undefined)
    startTransition(async () => {
      const result = vehicleId ? await updateVehicle(vehicleId, values) : await createVehicle(values)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
        <FormField control={form.control} name="internal_code" render={({ field }) => <FormItem><FormLabel>Identificador interno (opcional)</FormLabel><FormControl><Input {...field} value={field.value ?? ''} maxLength={INTERNAL_CODE_MAX} placeholder="Ej.: Blanco 01" autoComplete="off" /></FormControl><FormDescription>Cómo lo llaman en el día a día.</FormDescription><FormMessage /></FormItem>} />
        <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} maxLength={VEHICLE_TEXT_MAX} placeholder="Ej.: Ambulancia" autoComplete="off" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="brand" render={({ field }) => <FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} maxLength={VEHICLE_TEXT_MAX} autoComplete="off" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="model" render={({ field }) => <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} maxLength={VEHICLE_TEXT_MAX} autoComplete="off" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="year" render={({ field }) => <FormItem><FormLabel>Año</FormLabel><FormControl><Input {...field} value={Number.isNaN(field.value) ? '' : String(field.value)} onChange={(event) => field.onChange(event.target.valueAsNumber)} type="number" inputMode="numeric" min={1950} max={new Date().getFullYear() + 1} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="plate" render={({ field }) => <FormItem><FormLabel>Dominio</FormLabel><FormControl><Input {...field} maxLength={10} placeholder="Ej.: AB123CD" autoComplete="off" className="uppercase" /></FormControl><FormDescription>Se guarda en mayúsculas, sin espacios ni guiones.</FormDescription><FormMessage /></FormItem>} />
        {error && <Alert variant="destructive" className="md:col-span-2">{error}</Alert>}
        <div className="md:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Guardando...' : vehicleId ? 'Guardar' : 'Agregar vehículo'}</Button></div>
      </form>
    </Form>
  )
}
