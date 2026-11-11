'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { addVehicleRecord, completeVehicleRequest } from '@/app/fleet-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { completeVehicleRequestSchema, FLEET_DESCRIPTION_MAX, vehicleRecordKindLabels, vehicleRecordKinds, vehicleRecordSchema, WORKSHOP_MAX, type VehicleRecordValues } from '@/lib/fleet'
import { argentinaDate } from '@/lib/requests'

// Qué se hizo, cuándo y dónde. Dos usos:
// - `vehicleId`: carga directa en el historial (mantenimiento de rutina o reparación sin solicitud);
// - `requestId`: cierre de una solicitud de servicio (siempre reparación, sin selector de tipo).
export function VehicleRecordForm({ vehicleId, requestId }: { vehicleId?: string; requestId?: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const today = argentinaDate(Date.now())
  const closing = Boolean(requestId)
  const form = useForm<VehicleRecordValues>({
    resolver: zodResolver(closing ? completeVehicleRequestSchema.extend({ kind: vehicleRecordSchema.shape.kind }) : vehicleRecordSchema),
    defaultValues: { kind: closing ? 'repair' : 'maintenance', description: '', performed_on: today, workshop: '' },
  })

  function onSubmit(values: VehicleRecordValues) {
    setError(undefined)
    startTransition(async () => {
      const result = requestId
        ? await completeVehicleRequest(requestId, { description: values.description, performed_on: values.performed_on, workshop: values.workshop })
        : await addVehicleRecord(vehicleId!, values)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
        {!closing && (
          <FormField control={form.control} name="kind" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Tipo de registro"><SelectValue /></SelectTrigger>
                <SelectContent>{vehicleRecordKinds.map((kind) => <SelectItem key={kind} value={kind}>{vehicleRecordKindLabels[kind]}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}
        <FormField control={form.control} name="performed_on" render={({ field }) => <FormItem><FormLabel>Cuándo</FormLabel><FormControl><Input {...field} type="date" max={today} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="description" render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>{closing ? 'Qué se reparó' : 'Qué se hizo'}</FormLabel><FormControl><Textarea {...field} rows={3} maxLength={FLEET_DESCRIPTION_MAX} placeholder={closing ? 'Ej.: Cambio de pastillas y discos de freno delanteros' : 'Ej.: Cambio de aceite y filtros'} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="workshop" render={({ field }) => <FormItem className="md:col-span-2"><FormLabel>Dónde</FormLabel><FormControl><Input {...field} maxLength={WORKSHOP_MAX} placeholder="Taller, concesionario o lugar" autoComplete="off" /></FormControl><FormMessage /></FormItem>} />
        {error && <Alert variant="destructive" className="md:col-span-2">{error}</Alert>}
        <div className="md:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'Guardando...' : closing ? 'Completar solicitud' : 'Cargar en el historial'}</Button></div>
      </form>
    </Form>
  )
}
