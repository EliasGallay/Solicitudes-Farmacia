import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = ['Seleccionar productos', 'Revisar y confirmar', 'Solicitud enviada']

export function RequestStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Pasos de la solicitud" className="mb-6 flex flex-wrap items-center gap-3">
      {steps.map((label, index) => {
        const step = index + 1
        const done = step < current
        const active = step === current
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden className={cn('hidden h-px w-12 sm:block', done || active ? 'bg-primary-500' : 'bg-border-strong')} />}
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', done || active ? 'border-primary-600 bg-primary-600 text-white' : 'border-border-strong bg-surface text-foreground-secondary')}>
              {done ? <Check className="size-4" aria-hidden /> : step}
            </span>
            <span className={cn('text-sm', active ? 'font-semibold text-primary-600' : done ? 'text-primary-600' : 'text-foreground-secondary')}>
              {label}{done && <span className="sr-only"> (completado)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
