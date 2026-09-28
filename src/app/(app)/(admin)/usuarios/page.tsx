import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Plus, SearchX, Users } from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError, FormSuccess } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { UserFilters } from '@/components/users/user-filters'
import { UserStatusBadges } from '@/components/users/user-status-badges'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { areaName, getAreas } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { likeContains, listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema, searchParamSchema, searchTokens } from '@/lib/filters'
import { formatDateTime, relationOne } from '@/lib/requests'
import { requireRole, type AppRole } from '@/lib/session'
import { roleLabels, userRoles } from '@/lib/users'

const filtersSchema = z.object({
  buscar: searchParamSchema,
  rol: z.enum(userRoles).optional().catch(undefined),
  centro: z.string().uuid().optional().catch(undefined),
  estado: z.enum(['activo', 'inactivo']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/usuarios', { buscar: filters.buscar, rol: filters.rol, centro: filters.centro, estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole('admin')
  const params = await searchParams
  const filters = filtersSchema.parse(params)
  const { data: centers } = await supabase.from('health_centers').select('id, name').order('name')

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Administrá las cuentas, sus roles, centros y rubros habilitados."
        actions={<Link href="/usuarios/nuevo" className={buttonVariants()}><Plus />Nuevo usuario</Link>}
      />
      {(params.error || params.success) && (
        <div className="-mt-4 mb-6">
          <FormError>{feedbackMessage(params.error)}</FormError>
          <FormSuccess>{feedbackMessage(params.success)}</FormSuccess>
        </div>
      )}
      <UserFilters centers={(centers ?? []) as { id: string; name: string }[]} buscar={filters.buscar} rol={filters.rol} centro={filters.centro} estado={filters.estado} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <UsersList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

type UserRow = { id: string; fullName: string; email: string | null; role: AppRole; active: boolean; mustChangePassword: boolean; lastSignInAt: string | null; center: string | null; areas: string[] }

async function UsersList({ filters }: { filters: Filters }) {
  const { supabase, userId } = await requireRole('admin')
  // Email, último ingreso y búsqueda: columnas computadas de supabase/migrations/202609300001_user_admin.sql.
  let query = supabase.from('profiles').select('user_id, full_name, role, active, must_change_password, profile_email, profile_last_sign_in_at, health_center:health_centers(name), profile_areas(area)', { count: 'exact' })
  for (const token of searchTokens(filters.buscar ?? '')) query = query.ilike('profile_search_text', likeContains(token))
  if (filters.rol) query = query.eq('role', filters.rol)
  if (filters.centro) query = query.eq('health_center_id', filters.centro)
  if (filters.estado) query = query.eq('active', filters.estado === 'activo')
  const [{ data, count, error }, areas] = await Promise.all([query.order('full_name').range(...pageRange(filters.page, filters.por_pagina)), getAreas(true)])

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar los usuarios" />

  const rows: UserRow[] = (data ?? []).map((profile) => ({
    id: profile.user_id as string,
    fullName: profile.full_name as string,
    email: profile.profile_email as string | null,
    role: profile.role as AppRole,
    active: profile.active as boolean,
    mustChangePassword: profile.must_change_password as boolean,
    lastSignInAt: profile.profile_last_sign_in_at as string | null,
    center: relationOne(profile.health_center as { name: string } | { name: string }[] | null)?.name ?? null,
    areas: ((profile.profile_areas ?? []) as { area: string }[]).map((row) => areaName(areas ?? [], row.area)),
  }))
  const total = count ?? 0

  if (rows.length === 0) {
    return filters.buscar || filters.rol || filters.centro || filters.estado || total > 0
      ? <EmptyState icon={SearchX} title="No encontramos usuarios">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={Users} title="Todavía no hay usuarios" action={<Link href="/usuarios/nuevo" className={buttonVariants()}><Plus />Nuevo usuario</Link>} />
  }

  return (
    <>
      <CardContent className="pt-5">
        <MobileList>
          {rows.map((row) => (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/usuarios/${row.id}`} aria-label={`Ver ${row.fullName}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold break-words text-foreground">{row.fullName}{row.id === userId && ' (vos)'}</span>
                    <UserStatusBadges active={row.active} mustChangePassword={row.mustChangePassword} />
                  </div>
                  <p className="mt-1 text-xs leading-4 break-all text-foreground-secondary">{row.email ?? '—'}</p>
                  <p className="mt-1 text-xs leading-4 text-foreground-secondary">{[roleLabels[row.role], row.center, row.areas.join(', ')].filter(Boolean).join(' · ')}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          ))}
        </MobileList>
        <Table containerClassName="hidden md:block">
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Centro</TableHead>
              <TableHead className="hidden lg:table-cell">Rubros</TableHead>
              <TableHead className="hidden xl:table-cell">Último ingreso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <span className="font-semibold">{row.fullName}{row.id === userId && <span className="font-normal text-foreground-secondary"> (vos)</span>}</span>
                  <span className="block text-xs leading-4 text-foreground-secondary">{row.email ?? '—'}</span>
                </TableCell>
                <TableCell>{roleLabels[row.role]}</TableCell>
                <TableCell>{row.center ?? '—'}</TableCell>
                <TableCell className="hidden lg:table-cell">{row.areas.length > 0 ? row.areas.join(', ') : '—'}</TableCell>
                <TableCell className="hidden whitespace-nowrap xl:table-cell">{row.lastSignInAt ? formatDateTime(row.lastSignInAt) : 'Nunca'}</TableCell>
                <TableCell><div className="flex flex-wrap gap-1"><UserStatusBadges active={row.active} mustChangePassword={row.mustChangePassword} /></div></TableCell>
                <TableCell className="text-right">
                  <Link href={`/usuarios/${row.id}`} aria-label={`Ver ${row.fullName}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={rows.length} total={total} noun="usuarios" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
