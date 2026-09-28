import { cn } from '@/lib/utils'

// Clases completas y estáticas para que Tailwind las genere; índice = centerTone() de src/lib/centers.ts.
const badgeTones = [
  'bg-center-1-muted text-center-1',
  'bg-center-2-muted text-center-2',
  'bg-center-3-muted text-center-3',
  'bg-center-4-muted text-center-4',
  'bg-center-5-muted text-center-5',
  'bg-center-6-muted text-center-6',
  'bg-center-7-muted text-center-7',
  'bg-center-8-muted text-center-8',
]

const dotTones = ['bg-center-1', 'bg-center-2', 'bg-center-3', 'bg-center-4', 'bg-center-5', 'bg-center-6', 'bg-center-7', 'bg-center-8']

// Barra de color al inicio de una fila de tabla (primera celda).
export const centerRowTones = [
  'shadow-[inset_4px_0_0_var(--color-center-1)]',
  'shadow-[inset_4px_0_0_var(--color-center-2)]',
  'shadow-[inset_4px_0_0_var(--color-center-3)]',
  'shadow-[inset_4px_0_0_var(--color-center-4)]',
  'shadow-[inset_4px_0_0_var(--color-center-5)]',
  'shadow-[inset_4px_0_0_var(--color-center-6)]',
  'shadow-[inset_4px_0_0_var(--color-center-7)]',
  'shadow-[inset_4px_0_0_var(--color-center-8)]',
]

export function CenterDot({ tone, className }: { tone: number; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', dotTones[tone], className)} aria-hidden />
}

// El color es una ayuda visual: el nombre siempre se muestra.
export function CenterBadge({ name, tone, className }: { name: string; tone: number; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold', badgeTones[tone], className)}>
      <CenterDot tone={tone} />
      <span className="truncate">{name}</span>
    </span>
  )
}
