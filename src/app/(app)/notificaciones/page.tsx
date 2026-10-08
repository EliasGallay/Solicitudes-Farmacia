import { Suspense } from 'react'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { z } from 'zod'
import { markAllNotificationsRead } from '@/app/notification-actions'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { ListFooter } from '@/components/list-footer'
import { NotificationEntry } from '@/components/notifications/notification-entry'
import { NotificationFilters } from '@/components/notifications/notification-filters'
import { SyncNotificationCount } from '@/components/notifications/notification-count'
import { RequestListSkeleton } from '@/components/page-skeletons'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { getAreas } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema } from '@/lib/filters'
import { NOTIFICATION_SELECT, toNotificationItem, type NotificationRow } from '@/lib/notification-items'
import { countUnreadNotifications } from '@/lib/notifications'
import { formatDateTime } from '@/lib/requests'
import { requireSession } from '@/lib/session'

const filtersSchema = z.object({
  estado: z.enum(['no-leidas']).optional().catch(undefined),
  page: pageParamSchema,
  por_pagina: pageSizeParamSchema,
})
type Filters = z.infer<typeof filtersSchema>

function pageHref(filters: Filters, page: number) {
  return listHref('/notificaciones', { estado: filters.estado, por_pagina: pageSizeParam(filters.por_pagina) }, page)
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireSession()
  const params = await searchParams
  const filters = filtersSchema.parse(params)
  const unread = await countUnreadNotifications(supabase)

  return (
    <>
      <SyncNotificationCount count={unread} />
      <PageHeader
        title="Notificaciones"
        description="Novedades de las solicitudes que te tocan: solicitudes nuevas, entregas, cierres y diferencias en la recepción."
        actions={unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary" className="w-full"><CheckCheck aria-hidden />Marcar todas como leídas</Button>
          </form>
        )}
      />
      {feedbackMessage(params.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(params.error)}</FormError></div>}
      <div className="mb-4"><NotificationFilters estado={filters.estado} /></div>
      <Card>
        <Suspense key={pageHref(filters, filters.page)} fallback={<RequestListSkeleton rows={filters.por_pagina} />}>
          <NotificationList filters={filters} />
        </Suspense>
      </Card>
    </>
  )
}

async function NotificationList({ filters }: { filters: Filters }) {
  const { supabase, role } = await requireSession()
  let query = supabase.from('notifications').select(NOTIFICATION_SELECT, { count: 'exact' })
  if (filters.estado === 'no-leidas') query = query.is('read_at', null)
  const [{ data, count, error }, areas] = await Promise.all([
    query.order('created_at', { ascending: false }).range(...pageRange(filters.page, filters.por_pagina)),
    getAreas().then((result) => result ?? []),
  ])

  // PGRST103: la página pedida está fuera de rango; se trata como sin resultados.
  if (error && error.code !== 'PGRST103') return <ErrorState title="No pudimos cargar las notificaciones" />

  const notifications = data ?? []
  if (notifications.length === 0) {
    if (filters.estado) return <EmptyState icon={BellOff} title="No tenés notificaciones sin leer">Ya revisaste todas las novedades.</EmptyState>
    return (count ?? 0) > 0
      ? <EmptyState icon={BellOff} title="No hay notificaciones en esta página">Volvé a la primera página del listado.</EmptyState>
      : <EmptyState icon={Bell} title="Todavía no hay notificaciones">Acá vas a ver las novedades de las solicitudes que te tocan.</EmptyState>
  }

  return (
    <>
      <CardContent className="pt-5">
        <ul className="divide-y divide-border">
          {notifications.map((row) => {
            const item = toNotificationItem(row as NotificationRow, role, areas)
            return <li key={item.id} className="py-1 first:pt-0 last:pb-0"><NotificationEntry item={item} time={formatDateTime(item.createdAt)} /></li>
          })}
        </ul>
      </CardContent>
      <CardFooter divided><ListFooter page={filters.page} pageSize={filters.por_pagina} shown={notifications.length} total={count ?? 0} noun="notificaciones" hrefFor={(page) => pageHref(filters, page)} /></CardFooter>
    </>
  )
}
