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

// `compact`: en mobile, en lugar de card es un chip del color del tono con ícono y número, como un
// indicador de notificaciones (el texto queda para lectores de pantalla); desde sm se ve la card completa.
export function MetricCard({ icon: Icon, value, label, tone = 'default', href, compact = false }: { icon: LucideIcon; value: number; label: string; tone?: keyof typeof tones; href?: string; compact?: boolean }) {
  if (compact) return <CompactMetric icon={Icon} value={value} label={label} tone={tone} href={href} />

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
      <Card className="@container flex p-4 transition-colors sm:p-5 hover:border-border-hover hover:bg-surface-hover">{content}</Card>
    </Link>
  )
}

// Las clases sm: replican Card para que desde sm se vea igual que una MetricCard común.
function CompactMetric({ icon: Icon, value, label, tone, href }: { icon: LucideIcon; value: number; label: string; tone: keyof typeof tones; href?: string }) {
  const className = cn(
    'flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5',
    'sm:justify-start sm:gap-4 sm:rounded-lg sm:border sm:border-border sm:bg-surface sm:p-5 sm:text-foreground sm:shadow-card',
    tones[tone],
    href && 'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:hover:border-border-hover sm:hover:bg-surface-hover',
  )
  const content = (
    <>
      {/* En mobile el recuadro del ícono tiene el mismo fondo que el chip, así que no se nota. */}
      <span className={cn('flex shrink-0 items-center justify-center rounded-lg sm:size-12', tones[tone])}><Icon className="size-4 sm:size-6" aria-hidden /></span>
      <span className="sm:min-w-0 sm:flex-1">
        <span className="block text-sm leading-5 font-bold tabular-nums sm:text-3xl sm:leading-9 sm:text-foreground">{value}</span>
        <span className="sr-only sm:not-sr-only sm:block sm:text-sm sm:leading-5 sm:text-foreground-secondary">{label}</span>
      </span>
      {href && <ChevronRight className="hidden size-5 shrink-0 text-foreground-muted sm:block" aria-hidden />}
    </>
  )

  if (!href) return <div className={className}>{content}</div>
  return <Link href={href} title={label} className={className}>{content}</Link>
}
