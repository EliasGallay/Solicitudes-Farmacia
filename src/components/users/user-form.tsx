'use client'

import { useState, useTransition } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { KeyRound } from 'lucide-react'
import { createUser, updateUser } from '@/app/user-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editUserFormSchema, generateTemporaryPassword, newUserSchema, roleLabels, userRoles, type NewUserValues } from '@/lib/users'

type Option = { id: string; name: string }
type AreaOption = { key: string; name: string }

// Alta (sin `userId`: pide contraseña temporal) o edición de un usuario.
// Centro y rubros solo aplican al solicitante. `isSelf`: el admin editando su propia cuenta no
// puede cambiarse el rol (la base también lo impide).
export function UserForm({ userId, defaultValues, centers, areas, isSelf = false }: { userId?: string; defaultValues?: Omit<NewUserValues, 'password'>; centers: Option[]; areas: AreaOption[]; isSelf?: boolean }) {
  const creating = !userId
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const form = useForm<NewUserValues>({
    resolver: zodResolver(creating ? newUserSchema : editUserFormSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'requester',
      health_center_id: undefined,
      // Con un único rubro, el solicitante nuevo lo tiene marcado de entrada.
      areas: areas.length === 1 ? [areas[0].key] : [],
      password: '',
      ...defaultValues,
    },
  })
  const role = form.watch('role')

  function onSubmit(values: NewUserValues) {
    setError(undefined)
    startTransition(async () => {
      const result = userId ? await updateUser(userId, values) : await createUser(values)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
        <FormField control={form.control} name="full_name" render={({ field }) => <FormItem><FormLabel>Nombre y apellido</FormLabel><FormControl><Input {...field} maxLength={120} autoComplete="off" /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" autoComplete="off" /></FormControl>{!creating && <FormDescription>Es el usuario para ingresar. Si lo cambiás, pasa a usar el nuevo de inmediato.</FormDescription>}<FormMessage /></FormItem>} />
        <FormField control={form.control} name="role" render={({ field }) => (
          <FormItem>
            <FormLabel>Rol</FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
              <SelectTrigger aria-label="Rol"><SelectValue /></SelectTrigger>
              <SelectContent>{userRoles.map((value) => <SelectItem key={value} value={value}>{roleLabels[value]}</SelectItem>)}</SelectContent>
            </Select>
            <FormDescription>{isSelf ? 'No podés cambiar tu propio rol.' : role === 'admin' ? 'Administra todo el sistema: todos los rubros y centros.' : 'Hace solicitudes para su centro, en los rubros habilitados.'}</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        {role === 'requester' && (
          <FormField control={form.control} name="health_center_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Centro de salud</FormLabel>
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Centro de salud"><SelectValue placeholder="Seleccionar centro" /></SelectTrigger>
                <SelectContent>{centers.map((center) => <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {role === 'requester' && (
          <FormField control={form.control} name="areas" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">Rubros habilitados</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {areas.map((area) => (
                    <label key={area.key} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary-600"
                        checked={field.value.includes(area.key)}
                        onChange={(event) => field.onChange(event.target.checked ? [...field.value, area.key] : field.value.filter((key) => key !== area.key))}
                      />
                      {area.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {creating && (
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Contraseña temporal</FormLabel>
              <div className="flex max-w-md gap-2">
                <FormControl><Input {...field} type="text" autoComplete="off" spellCheck={false} className="font-mono" /></FormControl>
                <Button type="button" variant="secondary" onClick={() => form.setValue('password', generateTemporaryPassword(), { shouldValidate: true })}><KeyRound />Generar</Button>
              </div>
              <FormDescription>Compartila con el usuario: la va a tener que cambiar en su primer ingreso.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
        )}
        {error && <Alert variant="destructive" className="md:col-span-2">{error}</Alert>}
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : creating ? 'Crear usuario' : 'Guardar cambios'}</Button>
        </div>
      </form>
    </Form>
  )
}
