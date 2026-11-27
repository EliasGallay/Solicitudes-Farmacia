import Link from 'next/link'
import { IdCard } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { PageHeader } from '@/components/page-header'
import { RowActions } from '@/components/staff/row-actions'
import { StaffFilters } from '@/components/staff/staff-filters'
import { StaffCreateDialog } from '@/components/staff/staff-create-dialog'
import type { StaffCenter } from '@/components/staff/staff-form'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ListFooter } from '@/components/list-footer'
import { Card, CardFooter } from '@/components/ui/card'
import { listHref, pageParamSchema, pageSizeParam, pageSizeParamSchema } from '@/lib/filters'
import { MobileList, MobileListFields, MobileListHeader, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { argentinaDate, shiftDate } from '@/lib/requests'
import { requireRole } from '@/lib/session'
import { currentStatus, formatPersonName, type LeaveKind } from '@/lib/staff'

// Gestión de personal: tarjetas de resumen (filtros rápidos), búsqueda y filtros, y la tabla con el
// estado de hoy y un menú de acciones. Solo nombre, apellido, profesión, CAPS y licencias: los datos
// personales viven en la ficha.

const PATH = '/personal'

// Sin acentos ni mayúsculas, para que «gomez» encuentre «Gómez».
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

type Params = Record<string, string | undefined>

// Enlace que conserva los filtros actuales y cambia la vista rápida (si ya está activa, la quita).
function viewHref(params: Params, vista: string) {
  const next = new URLSearchParams()
  for (const key of ['q', 'profesion', 'centro', 'estado']) {
    if (params[key]) next.set(key, params[key] as string)
  }
  if (params.vista !== vista) next.set('vista', vista)
  return next.size ? `${PATH}?${next}` : PATH
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await requireRole('admin')
  const params = await searchParams
  const today = argentinaDate(new Date())
  const horizon = shiftDate(today, 7)
  const estado = params.estado === 'inactivo' || params.estado === 'todos' ? params.estado : 'activo'
  const vista = params.vista === 'hoy' || params.vista === 'proximos' ? params.vista : undefined
  const query = normalize((params.q ?? '').trim())

  const [membersResult, leavesResult, centersResult] = await Promise.all([
    supabase
      .from('staff_members')
      .select('id, first_name, last_name, profession, active, staff_member_health_centers(health_center_id, health_centers(name))')
      .order('last_name')
      .order('first_name'),
    // Licencias que tocan hoy o los próximos 7 días: alcanza para el estado de hoy y las tarjetas.
    supabase
      .from('staff_leaves')
      .select('staff_member_id, kind, starts_on, ends_on, hours')
      .is('voided_at', null)
      .gte('ends_on', today)
      .lte('starts_on', horizon),
    supabase.from('health_centers').select('id, name').eq('active', true).order('name'),
  ])

  if (membersResult.error || leavesResult.error || centersResult.error) {
    return <ErrorState />
  }

  const centers: StaffCenter[] = (centersResult.data ?? []).map((center) => ({ id: center.id as string, name: center.name as string }))

  const leavesByPerson = new Map<string, { kind: LeaveKind; startsOn: string; endsOn: string; hours: number | null }[]>()
  for (const row of leavesResult.data ?? []) {
    const id = row.staff_member_id as string
    const list = leavesByPerson.get(id) ?? []
    list.push({ kind: row.kind as LeaveKind, startsOn: row.starts_on as string, endsOn: row.ends_on as string, hours: (row.hours as number | null) ?? null })
    leavesByPerson.set(id, list)
  }

  const everyone = (membersResult.data ?? []).map((row) => {
    const id = row.id as string
    const caps = (row.staff_member_health_centers as unknown as { health_center_id: string; health_centers: { name: string } | null }[]) ?? []
    const leaves = leavesByPerson.get(id) ?? []
    return {
      id,
      firstName: formatPersonName(row.first_name as string),
      lastName: formatPersonName(row.last_name as string),
      profession: (row.profession as string | null) ?? '',
      active: row.active as boolean,
      centerIds: caps.map((item) => item.health_center_id),
      centerNames: caps.map((item) => item.health_centers?.name ?? '').filter(Boolean),
      status: currentStatus(leaves, today),
      onLeaveToday: leaves.some((leave) => leave.startsOn <= today && leave.endsOn >= today),
      leavesSoon: leaves.some((leave) => leave.startsOn > today && leave.startsOn <= horizon),
    }
  })

  const active = everyone.filter((member) => member.active)
  const counts = {
    hoy: active.filter((member) => member.onLeaveToday).length,
    proximos: active.filter((member) => member.leavesSoon).length,
    activo: active.length,
  }

  const professions = [...new Set(everyone.map((member) => member.profession).filter(Boolean))].sort()

  const members = everyone.filter((member) => {
    if (estado === 'activo' && !member.active) return false
    if (estado === 'inactivo' && member.active) return false
    if (params.centro && !member.centerIds.includes(params.centro)) return false
    if (params.profesion && member.profession !== params.profesion) return false
    if (vista === 'hoy' && !member.onLeaveToday) return false
    if (vista === 'proximos' && !member.leavesSoon) return false
    if (query && !normalize(`${member.firstName} ${member.lastName}`).includes(query)) return false
    return true
  })

  // Paginación del lado del servidor sobre la lista ya filtrada, igual que el resto de los listados.
  const pageSize = pageSizeParamSchema.parse(params.por_pagina)
  const total = members.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(pageParamSchema.parse(params.page), totalPages)
  const visible = members.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageHref = (target: number) =>
    listHref(PATH, { q: params.q, profesion: params.profesion, centro: params.centro, estado: estado === 'activo' ? undefined : estado, vista, por_pagina: pageSizeParam(pageSize) }, target)

  const cards = [
    { label: 'Hoy de licencia', value: counts.hoy, href: viewHref(params, 'hoy'), selected: vista === 'hoy' },
    { label: 'Próximos 7 días', value: counts.proximos, href: viewHref(params, 'proximos'), selected: vista === 'proximos' },
    { label: 'Personal activo', value: counts.activo, href: viewHref(params, ''), selected: !vista },
  ]

  const emptyWithoutFilters = everyone.length === 0

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Gestión de personal"
        description="Licencias y permisos del personal de salud."
        actions={<StaffCreateDialog centers={centers} />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            aria-current={card.selected ? 'true' : undefined}
            className={`rounded-lg border p-4 transition-colors hover:bg-surface-hover ${card.selected ? 'border-primary bg-surface-accent' : 'border-border bg-surface'}`}
          >
            <p className="text-sm text-foreground-secondary">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
          </Link>
        ))}
      </div>

      <StaffFilters
        q={params.q}
        profesion={params.profesion}
        centro={params.centro}
        estado={estado}
        professions={professions}
        centers={centers.map((center) => ({ value: center.id, label: center.name }))}
      />

      {emptyWithoutFilters ? (
        <EmptyState icon={IdCard} title="Todavía no hay personal cargado" action={<Link href={`${PATH}?nuevo=1`} className={buttonVariants({ variant: 'default' })}>Cargar trabajador</Link>}>
          Cargá la primera persona para empezar a registrar sus licencias.
        </EmptyState>
      ) : members.length === 0 ? (
        <EmptyState icon={IdCard} title="Ninguna persona coincide">
          Probá con otro nombre o quitá algún filtro.
        </EmptyState>
      ) : (
        <>
          <Card className="overflow-hidden">
          <Table containerClassName="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Profesión</TableHead>
                <TableHead>CAPS</TableHead>
                <TableHead>Estado hoy</TableHead>
                <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link href={`${PATH}/${member.id}`} className="font-semibold underline-offset-4 hover:underline">
                      {member.lastName}, {member.firstName}
                    </Link>
                  </TableCell>
                  <TableCell>{member.profession || '—'}</TableCell>
                  <TableCell>{member.centerNames.join(', ') || '—'}</TableCell>
                  <TableCell>
                    {member.active ? (
                      <Badge variant={member.status.tone === 'working' ? 'success' : 'warning'}>{member.status.label}</Badge>
                    ) : (
                      <Badge variant="neutral">Dado de baja</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions member={member} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4">
          <MobileList>
            {visible.map((member) => (
              <MobileListItem key={member.id}>
                <MobileListHeader
                  title={<Link href={`${PATH}/${member.id}`}>{member.lastName}, {member.firstName}</Link>}
                  subtitle={member.profession || undefined}
                  aside={member.active ? <Badge variant={member.status.tone === 'working' ? 'success' : 'warning'}>{member.status.label}</Badge> : <Badge variant="neutral">Dado de baja</Badge>}
                />
                <MobileListFields fields={[{ label: 'CAPS', value: member.centerNames.join(', ') || '—' }]} />
                <RowActions member={member} />
              </MobileListItem>
            ))}
          </MobileList>
          </div>
          <CardFooter divided>
            <ListFooter page={currentPage} pageSize={pageSize} shown={visible.length} total={total} noun="personas" hrefFor={pageHref} />
          </CardFooter>
          </Card>
        </>
      )}
    </div>
  )
}

