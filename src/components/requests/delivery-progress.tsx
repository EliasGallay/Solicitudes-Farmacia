import { Progress } from '@/components/ui/progress'

export function DeliveryProgress({ requested, delivered, pending }: { requested: number; delivered: number; pending: number }) {
  const percent = requested > 0 ? Math.round((delivered / requested) * 100) : 0
  return (
    <div className="flex flex-col gap-2">
      <Progress value={percent} aria-label="Progreso de entrega" />
      <div className="flex flex-wrap justify-between gap-2 text-sm leading-5">
        <span className="text-foreground-secondary">{percent}% entregado</span>
        <span className="font-semibold text-foreground">{pending} pendientes de {requested}</span>
      </div>
    </div>
  )
}
