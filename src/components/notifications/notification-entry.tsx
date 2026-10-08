import { openNotification } from '@/app/notification-actions'
import type { NotificationItem } from '@/lib/notification-items'
import { cn } from '@/lib/utils'

// Una notificación del listado o del panel de la campana. Al elegirla, openNotification la marca
// como leída y lleva a la solicitud. `time` llega formateado: el listado muestra la fecha y el panel
// el tiempo relativo.
export function NotificationEntry({ item, time, compact = false, onOpen }: { item: NotificationItem; time: string; compact?: boolean; onOpen?: () => void }) {
  return (
    <form action={openNotification} onSubmit={onOpen}>
      <input type="hidden" name="id" value={item.id} />
      <button type="submit" className={cn('flex w-full items-start gap-3 rounded-md text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', compact ? 'px-3 py-2.5' : 'px-2 py-2.5', item.unread && 'bg-surface-accent/50')}>
        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.unread ? 'bg-primary-600' : 'bg-transparent')} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className={cn('text-sm', item.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground-secondary')}>
              {item.title}
              {item.unread && <span className="sr-only"> (sin leer)</span>}
            </span>
            <span className="text-xs text-foreground-secondary tabular-nums">{time}</span>
          </span>
          <span className={cn('text-sm text-foreground-secondary', compact && 'line-clamp-2')}>{item.body}</span>
        </span>
      </button>
    </form>
  )
}
