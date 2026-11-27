import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { CopyValue } from '@/components/copy-value'
import { ErrorState } from '@/components/error-state'
import { LeaveDialog } from '@/components/staff/leave-dialog'
import { IncidentDialog } from '@/components/staff/incident-dialog'
import { IncidentEventDialog } from '@/components/staff/incident-event-dialog'
import { IncidentVoidDialog } from '@/components/staff/incident-void-dialog'
import { LeaveVoidDialog } from '@/components/staff/leave-void-dialog'
import { StaffForm, type StaffCenter, type StaffFormValues } from '@/components/staff/staff-form'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { argentinaDate, shiftDate } from '@/lib/requests'
import { requireRole } from '@/lib/session'
import { currentStatus, daysBetween, formatDate, formatDni, formatPersonName, leaveKindLabels, yearsSince, type LeaveKind } from '@/lib/staff'

// Ficha de una persona. Arriba, lo esencial para saber quién es y si está de licencia hoy. Después, los datos
// en tres bloques (laboral, contacto, personal) y el historial de licencias con su estado. Registrar
// licencia y anular se hacen en diálogos, para que la ficha quede limpia.

const PATH = '/personal'
const idSchema = z.string().uuid()

const kindTone: Record<LeaveKind, 'primary' | 'info' | 'neutral'> = { vacation: 'primary', hours_permit: 'info', other: 'neutral' }

// Estado de una licencia respecto de hoy.
function leaveState(leave: { startsOn: string; endsOn: string; voided: boolean }, today: string) {
  if (leave.voided) return { label: 'Anulada', tone: 'neutral' as const }
  if (leave.startsOn <= today && leave.endsOn >= today) return { label: 'En curso', tone: 'warning' as const }
  if (leave.startsOn > today) return { label: 'Programada', tone: 'info' as const }
  return { label: 'Finalizada', tone: 'neutral' as const }
}

// Línea de hoy: «De vacaciones · vuelve el 03/12/2026 (faltan 6 días)» o «Permiso 1,5 hs hoy».
function todayLine(status: { label: string; tone: string }, activeLeave: { kind: LeaveKind; endsOn: string } | undefined, today: string) {
  if (!activeLeave) return 'Trabajando hoy'
  if (activeLeave.kind === 'hours_permit') return `${status.label} hoy`
  const back = shiftDate(activeLeave.endsOn, 1)
  const days = daysBetween(today, back)
  return `${leaveKindLabels[activeLeave.kind]} · vuelve el ${formatDate(back)} (faltan ${days} ${days === 1 ? 'día' : 'días'})`
}

export default async function StaffProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { supabase } = await requireRole('admin')
  const { id: rawId } = await params
  const id = idSchema.safeParse(rawId)
  if (!id.success) notFound()
  const query = await searchParams
  const editing = query.editar === '1'
  const registering = query.licencia === '1'
  const today = argentinaDate(new Date())

  const [memberResult, leavesResult, centersResult, incidentsResult] = await Promise.all([
    supabase
      .from('staff_members')
      .select('id, first_name, last_name, profession, matricula, dni, phone, address, email, birth_date, hire_date, comment, active, staff_member_health_centers(health_center_id)')
      .eq('id', id.data)
      .maybeSingle(),
    supabase
      .from('staff_leaves')
      .select('id, kind, starts_on, ends_on, days, hours, note, comment, voided_at, void_reason')
      .eq('staff_member_id', id.data)
      .order('starts_on', { ascending: false }),
    supabase.from('health_centers').select('id, name').eq('active', true).order('name'),
    supabase
      .from('staff_incidents')
      .select('id, category, occurred_on, ends_on, description, voided_at, void_reason, staff_incident_events(id, event_on, note)')
      .eq('staff_member_id', id.data)
      .order('occurred_on', { ascending: false }),
  ])

  if (memberResult.error || leavesResult.error || centersResult.error || incidentsResult.error) return <ErrorState />
  if (!memberResult.data) notFound()

  const member = memberResult.data
  const centers: StaffCenter[] = (centersResult.data ?? []).map((center) => ({ id: center.id as string, name: center.name as string }))
  const caps = ((member.staff_member_health_centers as unknown as { health_center_id: string }[]) ?? []).map((item) => item.health_center_id)
  const capsNames = centers.filter((center) => caps.includes(center.id)).map((center) => center.name)
  const firstName = formatPersonName(member.first_name as string)
  const lastName = formatPersonName(member.last_name as string)
  const fullName = `${lastName}, ${firstName}`
  const personName = `${firstName} ${lastName}`

  const initial: StaffFormValues = {
    first_name: member.first_name as string,
    last_name: member.last_name as string,
    profession: (member.profession as string | null) ?? '',
    matricula: (member.matricula as string | null) ?? '',
    dni: (member.dni as string | null) ?? '',
    phone: (member.phone as string | null) ?? '',
    address: (member.address as string | null) ?? '',
    email: (member.email as string | null) ?? '',
    birth_date: (member.birth_date as string | null) ?? '',
    hire_date: (member.hire_date as string | null) ?? '',
    comment: (member.comment as string | null) ?? '',
    health_center_ids: caps,
  }

  const leaves = (leavesResult.data ?? []).map((leave) => ({
    id: leave.id as string,
    kind: leave.kind as LeaveKind,
    startsOn: leave.starts_on as string,
    endsOn: leave.ends_on as string,
    days: (leave.days as number | null) ?? null,
    hours: (leave.hours as number | null) ?? null,
    note: (leave.note as string | null) ?? null,
    comment: (leave.comment as string | null) ?? null,
    voided: leave.voided_at !== null,
    voidReason: (leave.void_reason as string | null) ?? null,
  }))

  const incidents = (incidentsResult.data ?? []).map((incident) => ({
    id: incident.id as string,
    category: incident.category as string,
    occurredOn: incident.occurred_on as string,
    endsOn: (incident.ends_on as string | null) ?? null,
    description: (incident.description as string | null) ?? null,
    voided: incident.voided_at !== null,
    voidReason: (incident.void_reason as string | null) ?? null,
    events: ((incident.staff_incident_events as { id: string; event_on: string; note: string }[] | null) ?? [])
      .slice()
      .sort((a, b) => a.event_on.localeCompare(b.event_on)),
  }))

  const activeLeave = leaves.find((leave) => !leave.voided && leave.startsOn <= today && leave.endsOn >= today)
  const status = currentStatus(
    leaves.filter((leave) => !leave.voided).map((leave) => ({ kind: leave.kind, startsOn: leave.startsOn, endsOn: leave.endsOn, hours: leave.hours })),
    today,
  )
  const hireDate = member.hire_date as string | null
  const birthDate = member.birth_date as string | null
  const antiquity = hireDate ? yearsSince(hireDate, today) : null
  const age = birthDate ? yearsSince(birthDate, today) : null
  const dni = member.dni as string | null
  const phone = member.phone as string | null
  const email = member.email as string | null
  const address = member.address as string | null
  const profession = member.profession as string | null
  const matricula = member.matricula as string | null
  const comment = member.comment as string | null

  const summary = [profession, capsNames.length ? `CAPS ${capsNames.join(', ')}` : null, matricula ? `Mat. ${matricula}` : null, antiquity !== null ? `${antiquity} ${antiquity === 1 ? 'año' : 'años'} de antigüedad` : null]
    .filter(Boolean)
    .join(' · ')

  // Un campo vacío se muestra como «Sin cargar» con un enlace para completarlo. Etiqueta y valor van
  // juntos (poco aire); entre campos, algo más de separación.
  const field = (label: string, value: React.ReactNode, missing = false) => (
    <div className="grid gap-0.5">
      <dt className="text-xs text-foreground-secondary">{label}</dt>
      <dd className="text-sm font-medium text-foreground">
        {missing ? (
          <span className="flex items-center gap-2 text-foreground-muted">
            Sin cargar
            <Link href={`${PATH}/${id.data}?editar=1`} className="text-xs font-semibold text-primary-700 underline-offset-4 hover:underline">Agregar</Link>
          </span>
        ) : value}
      </dd>
    </div>
  )

  // Subtítulo chico dentro de la tarjeta de datos.
  const group = (title: string, children: React.ReactNode) => (
    <section className="grid content-start gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-foreground-secondary uppercase">{title}</h3>
      <dl className="grid gap-3">{children}</dl>
    </section>
  )

  return (
    <div className="grid gap-6">
      <Link href={PATH} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-foreground-secondary hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Gestión de personal
      </Link>

      <PageHeader
        title={fullName}
        description={
          <span className="grid gap-2">
            {summary && <span className="text-sm text-foreground-secondary">{summary}</span>}
            <span className="inline-flex flex-wrap items-center gap-2">
              {member.active ? (
                <Badge variant={status.tone === 'working' ? 'success' : 'warning'}>{todayLine(status, activeLeave, today)}</Badge>
              ) : (
                <Badge variant="neutral">Dada de baja</Badge>
              )}
              {comment ? <Badge variant="neutral" className="max-w-full truncate" title={comment}>Nota: {comment}</Badge> : null}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LeaveDialog staffMemberId={id.data} personName={personName} triggerLabel="Registrar licencia" openOnMount={registering} />
            <Link href={`${PATH}/${id.data}?editar=1`} className={buttonVariants({ variant: 'secondary' })}>Editar ficha</Link>
          </div>
        }
      />

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Editar ficha</CardTitle></CardHeader>
          <CardContent>
            <StaffForm centers={centers} initial={initial} staffMemberId={id.data} onCancelHref={`${PATH}/${id.data}`} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6">
        {/* Una sola tarjeta de datos: profesión, matrícula y CAPS ya están en el subtítulo, así que acá solo
            aparecen si faltan (con «Agregar»). */}
        {!editing ? (
        <Card>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-3">
            {group('Laboral', (
              <>
                {!profession ? field('Profesión', null, true) : null}
                {!matricula ? field('Matrícula', null, true) : null}
                {capsNames.length === 0 ? field('CAPS', null, true) : null}
                {field('Ingreso', hireDate ? `${formatDate(hireDate)}${antiquity !== null ? ` · ${antiquity} ${antiquity === 1 ? 'año' : 'años'}` : ''}` : null, !hireDate)}
              </>
            ))}

            {group('Contacto', (
              <>
                {field('Teléfono', phone ? <CopyValue value={phone} href={`tel:${phone}`} /> : null, !phone)}
                {field('Email', email ? <CopyValue value={email} href={`mailto:${email}`} /> : null, !email)}
                {field('Dirección', address, !address)}
              </>
            ))}

            {group('Personal', (
              <>
                {field('DNI', dni ? <CopyValue value={formatDni(dni)} /> : null, !dni)}
                {field('Nacimiento', birthDate ? `${formatDate(birthDate)}${age !== null ? ` · ${age} años` : ''}` : null, !birthDate)}
              </>
            ))}
          </CardContent>
        </Card>
        ) : null}

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Historial de licencias</CardTitle>
          </CardHeader>
          {leaves.length === 0 ? (
            <CardContent>
              <p className="text-sm text-foreground-secondary">
                Todavía no tiene licencias.{' '}
                <Link href={`${PATH}/${id.data}?licencia=1`} className="font-semibold text-primary-700 underline-offset-4 hover:underline">Registrar la primera</Link>
              </p>
            </CardContent>
          ) : (
            <>
              <Table containerClassName="hidden md:block">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Rango</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.map((leave) => {
                    const state = leaveState({ startsOn: leave.startsOn, endsOn: leave.endsOn, voided: leave.voided }, today)
                    const current = state.label === 'En curso'
                    const when = leave.startsOn === leave.endsOn ? formatDate(leave.startsOn) : `${formatDate(leave.startsOn)} al ${formatDate(leave.endsOn)}`
                    const amount = leave.kind === 'hours_permit' ? `${String(leave.hours).replace('.', ',')} hs` : `${leave.days} ${leave.days === 1 ? 'día' : 'días'}`
                    return (
                      <TableRow key={leave.id} className={current ? 'bg-surface-accent' : undefined}>
                        <TableCell>
                          <Badge variant={kindTone[leave.kind]}>{leaveKindLabels[leave.kind]}</Badge>
                        </TableCell>
                        <TableCell className={leave.voided ? 'text-foreground-muted line-through' : undefined}>{when}</TableCell>
                        <TableCell>{amount}</TableCell>
                        <TableCell className="max-w-56 text-foreground-secondary">
                          {leave.note ?? leave.comment ?? '—'}
                          {leave.voided && leave.voidReason ? <span className="block text-xs">Anulada: {leave.voidReason}</span> : null}
                        </TableCell>
                        <TableCell><Badge variant={state.tone === 'warning' ? 'warning' : state.tone === 'info' ? 'info' : 'neutral'}>{state.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          {leave.voided ? null : (
                            <span className="inline-flex items-center gap-1">
                              <LeaveDialog staffMemberId={id.data} personName={personName} triggerLabel="Corregir" leave={leave} />
                              <LeaveVoidDialog leaveId={leave.id} staffMemberId={id.data} label={`${leaveKindLabels[leave.kind]} · ${when}`} />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="p-4 md:hidden">
                <MobileList>
                  {leaves.map((leave) => {
                    const state = leaveState({ startsOn: leave.startsOn, endsOn: leave.endsOn, voided: leave.voided }, today)
                    const when = leave.startsOn === leave.endsOn ? formatDate(leave.startsOn) : `${formatDate(leave.startsOn)} al ${formatDate(leave.endsOn)}`
                    return (
                      <MobileListItem key={leave.id}>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={kindTone[leave.kind]}>{leaveKindLabels[leave.kind]}</Badge>
                          <Badge variant={state.tone === 'warning' ? 'warning' : state.tone === 'info' ? 'info' : 'neutral'}>{state.label}</Badge>
                        </div>
                        <p className="text-sm font-medium">{when}</p>
                        {leave.voided ? null : (
                          <div className="flex flex-wrap gap-1">
                            <LeaveDialog staffMemberId={id.data} personName={personName} triggerLabel="Corregir" leave={leave} />
                            <LeaveVoidDialog leaveId={leave.id} staffMemberId={id.data} label={`${leaveKindLabels[leave.kind]} · ${when}`} />
                          </div>
                        )}
                      </MobileListItem>
                    )
                  })}
                </MobileList>
              </div>
            </>
          )}
        </Card>

        {/* Novedades (docs/plans/diseno-novedades-personal.md): hechos del trabajador que no son licencias. No
            cuentan para el estado de hoy ni para los solapamientos. */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Novedades</CardTitle>
            <IncidentDialog staffMemberId={id.data} personName={personName} />
          </CardHeader>
          {incidents.length === 0 ? (
            <CardContent>
              <p className="text-sm text-foreground-secondary">Todavía no tiene novedades registradas.</p>
            </CardContent>
          ) : (
            <ul className="grid divide-y divide-border">
              {incidents.map((incident) => {
                const when = incident.endsOn ? `${formatDate(incident.occurredOn)} al ${formatDate(incident.endsOn)}` : formatDate(incident.occurredOn)
                const label = `${incident.category} · ${when}`
                return (
                  <li key={incident.id} className="grid gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className={`grid gap-1 ${incident.voided ? 'text-foreground-muted line-through' : ''}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">{incident.category}</Badge>
                          <span className="text-sm font-medium">{when}</span>
                        </div>
                        {incident.description ? <p className="text-sm text-foreground-secondary">{incident.description}</p> : null}
                        {incident.voided && incident.voidReason ? <p className="text-xs text-foreground-secondary">Anulada: {incident.voidReason}</p> : null}
                      </div>
                      {incident.voided ? null : (
                        <div className="flex flex-wrap gap-1">
                          <IncidentDialog staffMemberId={id.data} personName={personName} incident={incident} />
                          <IncidentEventDialog incidentId={incident.id} staffMemberId={id.data} occurredOn={incident.occurredOn} label={label} />
                          <IncidentVoidDialog incidentId={incident.id} staffMemberId={id.data} label={label} />
                        </div>
                      )}
                    </div>
                    {incident.events.length > 0 ? (
                      <ol className="grid gap-1 border-l border-border pl-3">
                        {incident.events.map((event) => (
                          <li key={event.id} className="text-sm">
                            <span className="font-medium">{formatDate(event.event_on)}</span>
                            <span className="text-foreground-secondary"> · {event.note}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
