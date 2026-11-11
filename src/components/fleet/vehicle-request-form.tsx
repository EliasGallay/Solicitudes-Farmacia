'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createVehicleRequest } from '@/app/fleet-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FLEET_DESCRIPTION_MAX, vehicleRequestSchema, type VehicleRequestValues } from '@/lib/fleet'

// Solicitud de servicio o reparación: vehículo activo y descripción libre del problema.
export function VehicleRequestForm({ vehicles, vehicleId }: { vehicles: { id: string; label: string }[]; vehicleId?: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const form = useForm<VehicleRequestValues>({ resolver: zodResolver(vehicleRequestSchema), defaultValues: { vehicle_id: vehicleId ?? (vehicles.length === 1 ? vehicles[0].id : ''), description: '' } })

  function onSubmit(values: VehicleRequestValues) {
    setError(undefined)
    startTransition(async () => {
      const result = await createVehicleRequest(values)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
        <FormField control={form.control} name="vehicle_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Vehículo</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Vehículo"><SelectValue placeholder="Elegí el vehículo" /></SelectTrigger>
              <SelectContent>{vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.label}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Qué necesita</FormLabel>
            <FormControl><Textarea {...field} rows={5} maxLength={FLEET_DESCRIPTION_MAX} placeholder="Ej.: Ruido en el tren delantero al frenar. Revisar frenos." /></FormControl>
            <FormDescription>Contá el problema o el servicio que hace falta, con todo lo que ayude a resolverlo.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        {error && <Alert variant="destructive">{error}</Alert>}
        <div><Button type="submit" disabled={pending}>{pending ? 'Enviando...' : 'Enviar solicitud'}</Button></div>
      </form>
    </Form>
  )
}
