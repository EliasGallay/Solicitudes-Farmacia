import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// `short`: label visible debajo de sm, donde los tres pasos comparten ~290px.
const steps = [
  { label: 'Seleccionar productos', short: 'Productos' },
  { label: 'Revisar y confirmar', short: 'Revisión' },
  { label: 'Solicitud enviada', short: 'Enviada' },
]

// El stepper se monta de nuevo en cada paso: las animaciones de entrada marcan solo la
// transición recién ocurrida (línea hacia el paso actual, paso actual y paso recién completado).
export function RequestStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Pasos de la solicitud" className="mb-6 flex items-start justify-center sm:mb-8">
      {steps.map(({ label, short }, index) => {
        const step = index + 1
        const done = step < current
        const active = step === current
        const justCompleted = step === current - 1
        const reached = done || active

        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex items-start">
            {index > 0 && (
              <span aria-hidden className="mt-4 h-0.5 w-4 overflow-hidden rounded-full bg-border-strong sm:w-24">
                {reached && <span className={cn('block h-full origin-left bg-primary-500', active && 'motion-safe:animate-step-fill')} />}
              </span>
            )}
            <div className="flex w-20 flex-col items-center gap-2 text-center sm:w-40">
              <span className="relative flex size-9 items-center justify-center">
                {active && <span aria-hidden className="absolute inset-0 rounded-full bg-primary-400 motion-safe:animate-step-halo" />}
                <span
                  className={cn(
                    'relative flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    reached ? 'border-primary-600 bg-primary-600 text-white' : 'border-border-strong bg-surface text-foreground-secondary',
                    active && 'ring-4 ring-primary-100 motion-safe:animate-step-pop-delayed',
                  )}
                >
                  {done ? <Check className={cn('size-4', justCompleted && 'motion-safe:animate-step-pop')} aria-hidden /> : step}
                </span>
              </span>
              <span className={cn('text-xs leading-4 sm:text-sm sm:leading-5', active ? 'font-semibold text-primary-600' : done ? 'text-primary-600' : 'text-foreground-secondary')}>
                <span aria-hidden className="sm:hidden">{short}</span>
                <span className="max-sm:sr-only">{label}</span>
                {done && <span className="sr-only"> (completado)</span>}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
