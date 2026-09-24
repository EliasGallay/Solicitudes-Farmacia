import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const iconTones = {
  default: 'bg-primary-100 text-primary-600',
  danger: 'bg-danger-muted text-danger',
}

export function EmptyState({ icon: Icon, title, children, action, tone = 'default', className }: { icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode; tone?: keyof typeof iconTones; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {Icon && <div className={cn('mb-1 flex size-12 items-center justify-center rounded-full', iconTones[tone])}><Icon className="size-6" aria-hidden /></div>}
      {title && <p className="text-base leading-6 font-semibold text-foreground">{title}</p>}
      {children && <div className="max-w-md text-sm leading-5 text-foreground-secondary">{children}</div>}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}
