import { Suspense } from 'react'
import Link from 'next/link'
import { ClipboardList, SearchX } from 'lucide-react'
import { z } from 'zod'
import { AuditFilters } from '@/components/audit/audit-filters'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { ListFooter } from '@/components/list-footer'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { auditActionLabel, auditActions, auditEntityHref } from '@/lib/audit'
import { listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema } from '@/lib/filters'
import { formatDateTime, relationOne, shiftDate } from '@/lib/requests'
import { requireRole } from '@/lib/session'

// Argentina no aplica horario de verano: los límites de día se expresan en -03:00.
const DAY_OFFSET = '-03:00'
const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined)

const filtersSchema = z.object({
  accion: z.enum(auditActions).optional().catch(undefined),
  usuario: z.string().uuid().optional().catch(undefined),
  desde: dateParamSchema,
  hasta: dateParamSchema,
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/auditoria', { accion: filters.accion, usuario: filters.usuario, desde: filters.desde, hasta: filters.hasta, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole('admin')
  const filters = filtersSchema.parse(await searchParams)
  const { data: users } = await supabase.from('profiles').select('user_id, full_name').order('full_name')

  return (
    <>
      <PageHeader title="Auditoría" description="Registro inmutable de las operaciones sobre solicitudes y entregas: quién hizo qué, cuándo y por qué." />
      <AuditFilters users={(users ?? []).map((user) => ({ id: user.user_id as string, name: user.full_name as string }))} accion={filters.accion} usuario={filters.usuario} desde={filters.desde} hasta={filters.hasta} />
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <AuditList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

async function AuditList({ filters }: { filters: Filters }) {
  const { supabase } = await requireRole('admin')
  let query = supabase.from('audit_events').select('id, action, entity_type, entity_id, before_data, after_data, reason, created_at, actor:profiles(full_name)', { count: 'exact' })
  if (filters.accion) query = query.eq('action', filters.accion)
  if (filters.usuario) query = query.eq('actor_id', filters.usuario)
  if (filters.desde) query = query.gte('created_at', `${filters.desde}T00:00:00${DAY_OFFSET}`)
  if (filters.hasta) query = query.lt('created_at', `${shiftDate(filters.hasta, 1)}T00:00:00${DAY_OFFSET}`)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(...pageRange(filters.page, filters.por_pagina))

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar la auditoría" />

  const events = data ?? []
  if (events.length === 0) {
    return filters.accion || filters.usuario || filters.desde || filters.hasta || (count ?? 0) > 0
      ? <EmptyState icon={SearchX} title="No encontramos eventos">Probá modificando los filtros aplicados.</EmptyState>
      : <EmptyState icon={ClipboardList} title="Todavía no hay eventos">Cada solicitud, entrega, cierre y anulación queda registrada acá.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5">
        <ul className="divide-y divide-border">
          {events.map((event) => {
            const href = auditEntityHref(event.entity_type as string, event.entity_id as string)
            return (
              <li key={event.id as string} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold">
                    {auditActionLabel(event.action as string)}
                    {href && <> · <Link href={href} className="font-normal text-primary-600 hover:underline">ver {event.entity_type === 'delivery' ? 'entrega' : 'solicitud'}</Link></>}
                  </p>
                  <p className="text-xs text-foreground-secondary tabular-nums">{formatDateTime(event.created_at as string)}</p>
                </div>
                <p className="text-sm text-foreground-secondary">
                  {relationOne(event.actor as { full_name: string } | { full_name: string }[] | null)?.full_name ?? '—'} · Motivo: <span className="text-foreground">{event.reason as string}</span>
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer text-foreground-secondary hover:text-foreground">Datos antes y después</summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {[['Antes', event.before_data], ['Después', event.after_data]].map(([label, value]) => (
                      <div key={label as string} className="min-w-0">
                        <p className="mb-1 font-semibold text-foreground-secondary">{label as string}</p>
                        <pre className="overflow-x-auto rounded-md bg-surface-muted p-2">{value ? JSON.stringify(value, null, 2) : '—'}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={events.length} total={count ?? 0} noun="eventos" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
