import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const tones = {
  default: 'bg-primary-100 text-primary-600',
  warning: 'bg-warning-muted text-warning',
  info: 'bg-info-muted text-info',
  success: 'bg-success-muted text-success',
}

export function MetricCard({ icon: Icon, value, label, tone = 'default', href }: { icon: LucideIcon; value: number; label: string; tone?: keyof typeof tones; href?: string }) {
  // Container query: en cards angostas (2 columnas en mobile) el ícono va arriba del número.
  const content = (
    <div className="flex w-full flex-col items-start gap-3 @[13rem]:flex-row @[13rem]:items-center sm:gap-4">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12', tones[tone])}><Icon className="size-5 sm:size-6" aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl leading-8 font-bold text-foreground tabular-nums sm:text-3xl sm:leading-9">{value}</p>
        <p className="text-xs leading-4 text-foreground-secondary sm:text-sm sm:leading-5">{label}</p>
      </div>
      {href && <ChevronRight className="hidden size-5 shrink-0 text-foreground-muted @[13rem]:block" aria-hidden />}
    </div>
  )

  if (!href) return <Card className="@container flex p-4 sm:p-5">{content}</Card>
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
      <Card className="@container flex p-4 transition-colors sm:p-5 hover:border-primary-100 hover:bg-primary-50">{content}</Card>
    </Link>
  )
}
