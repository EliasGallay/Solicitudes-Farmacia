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
  const content = (
    <>
      <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-lg', tones[tone])}><Icon className="size-6" aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <p className="text-3xl leading-9 font-bold text-foreground">{value}</p>
        <p className="text-sm leading-5 text-foreground-secondary">{label}</p>
      </div>
      {href && <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />}
    </>
  )

  if (!href) return <Card className="flex items-center gap-4 p-5">{content}</Card>
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
      <Card className="flex items-center gap-4 p-5 transition-colors hover:border-primary-100 hover:bg-primary-50">{content}</Card>
    </Link>
  )
}
