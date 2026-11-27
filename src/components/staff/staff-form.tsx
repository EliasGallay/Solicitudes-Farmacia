'use client'

import Link from 'next/link'
import { useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createStaffMember, updateStaffMember } from '@/app/staff-actions'
import { DateField } from '@/components/date-field'
import { FormError } from '@/components/form-feedback'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { argentinaDate } from '@/lib/requests'
import { cn } from '@/lib/utils'

// Alta y edición de una persona. Solo nombre y apellido son obligatorios (marcados con asterisco); el
// resto se completa cuando haga falta. Los errores vuelven como texto para no perder lo cargado.

export type StaffCenter = { id: string; name: string }

export type StaffFormValues = {
  first_name: string
  last_name: string
  profession: string
  matricula: string
  dni: string
  phone: string
  address: string
  email: string
  birth_date: string
  hire_date: string
  comment: string
  health_center_ids: string[]
}

export const emptyStaffForm: StaffFormValues = {
  first_name: '',
  last_name: '',
  profession: '',
  matricula: '',
  dni: '',
  phone: '',
  address: '',
  email: '',
  birth_date: '',
  hire_date: '',
  comment: '',
  health_center_ids: [],
}

// Fecha de hoy en Argentina: tope para nacimiento e ingreso (no pueden ser futuros).
const todayIso = () => argentinaDate(new Date())

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <h3 className="text-xs font-semibold tracking-wide text-foreground-secondary uppercase col-span-full">{title}</h3>
      {children}
    </section>
  )
}

// Dentro de un diálogo se pasa `onCancel` (cierra el diálogo) y `footerTarget` (el pie fijo del diálogo,
// fuera del cuerpo que hace scroll); en una página, `onCancelHref`.
export function StaffForm({
  centers,
  initial,
  staffMemberId,
  onCancelHref,
  onCancel,
  formId,
  footerTarget,
}: {
  centers: StaffCenter[]
  initial?: StaffFormValues
  staffMemberId?: string
  onCancelHref?: string
  onCancel?: () => void
  formId?: string
  footerTarget?: HTMLElement | null
}) {
  const [values, setValues] = useState<StaffFormValues>(initial ?? emptyStaffForm)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (field: keyof StaffFormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }))

  const setDate = (field: 'birth_date' | 'hire_date') => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  const toggleCenter = (id: string) =>
    setValues((current) => ({
      ...current,
      health_center_ids: current.health_center_ids.includes(id)
        ? current.health_center_ids.filter((value) => value !== id)
        : [...current.health_center_ids, id],
    }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = staffMemberId ? await updateStaffMember(staffMemberId, values) : await createStaffMember(values)
      // Si la acción tiene éxito redirige; acá solo llega el error.
      if (result?.error) setError(result.error)
    })
  }

  // El botón de envío apunta al formulario con `form`, así que también envía cuando está en el pie.
  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" form={formId} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      {onCancel ? (
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      ) : (
        <Link href={onCancelHref ?? '/personal'} className={buttonVariants({ variant: 'ghost' })}>Cancelar</Link>
      )}
    </div>
  )

  return (
    <form id={formId} onSubmit={submit} className="grid gap-6">
      <Section title="Datos personales">
        <div className="grid gap-1.5">
          <Label htmlFor="first_name">Nombre <span aria-hidden className="text-danger">*</span></Label>
          <Input id="first_name" value={values.first_name} onChange={set('first_name')} required maxLength={80} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="last_name">Apellido <span aria-hidden className="text-danger">*</span></Label>
          <Input id="last_name" value={values.last_name} onChange={set('last_name')} required maxLength={80} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="dni">DNI</Label>
          <Input id="dni" inputMode="numeric" value={values.dni} onChange={set('dni')} maxLength={9} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="birth_date">Fecha de nacimiento</Label>
          <DateField id="birth_date" value={values.birth_date} max={todayIso()} startAt="1990-01-01" years={[1930, Number(todayIso().slice(0, 4))]} onChange={setDate('birth_date')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" value={values.phone} onChange={set('phone')} maxLength={30} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={values.email} onChange={set('email')} maxLength={120} />
        </div>
        <div className="grid gap-1.5 col-span-full">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" value={values.address} onChange={set('address')} maxLength={120} />
        </div>
      </Section>

      <Section title="Datos laborales">
        <div className="grid gap-1.5">
          <Label htmlFor="profession">Profesión</Label>
          <Input id="profession" value={values.profession} onChange={set('profession')} maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="matricula">Matrícula</Label>
          <Input id="matricula" value={values.matricula} onChange={set('matricula')} maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hire_date">Fecha de ingreso</Label>
          <DateField id="hire_date" value={values.hire_date} max={todayIso()} years={[1930, Number(todayIso().slice(0, 4))]} onChange={setDate('hire_date')} />
        </div>
        <div className="grid gap-2 col-span-full">
          <span className="text-sm font-medium">CAPS donde trabaja</span>
          {centers.length === 0 ? (
            <p className="text-sm text-foreground-secondary">No hay CAPS activos cargados.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="CAPS donde trabaja">
              {centers.map((center) => {
                const selected = values.health_center_ids.includes(center.id)
                return (
                  <button
                    key={center.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleCenter(center.id)}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      selected ? 'border-primary-500 bg-primary-100 font-semibold text-primary-700' : 'border-border bg-surface text-foreground hover:bg-surface-hover',
                    )}
                  >
                    {center.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Section>

      <Section title="Notas">
        <div className="grid gap-1.5 col-span-full">
          <Label htmlFor="comment">Comentario</Label>
          <Textarea id="comment" value={values.comment} onChange={set('comment')} maxLength={500} rows={2} />
        </div>
      </Section>

      {error ? <FormError>{error}</FormError> : null}

      {/* Con `footerTarget` los botones van al pie fijo del diálogo; si no, al final del formulario. */}
      {footerTarget ? createPortal(actions, footerTarget) : actions}
    </form>
  )
}
