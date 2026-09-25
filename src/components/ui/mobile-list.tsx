import * as React from 'react'
import { cn } from '@/lib/utils'

// Alternativa a <Table> debajo de md: cada fila es un bloque con título, datos y acción.
// Se renderiza junto a la tabla (que usa `containerClassName="hidden md:block"`) con el mismo contenido.

export function MobileList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('divide-y divide-border md:hidden', className)} {...props} />
}

export function MobileListItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn('flex flex-col gap-3 py-4 first:pt-0 last:pb-0', className)} {...props} />
}

// Cabecera del ítem: título (y subtítulo) a la izquierda, contenido secundario (badge, acción) a la derecha.
export function MobileListHeader({ title, subtitle, aside }: { title: React.ReactNode; subtitle?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm leading-5 font-semibold break-words text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs leading-4 break-words text-foreground-secondary">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  )
}

// Pares etiqueta/valor en columnas iguales (p. ej. Solicitado / Entregado / Pendiente).
export function MobileListFields({ fields, className }: { fields: { label: string; value: React.ReactNode; className?: string }[]; className?: string }) {
  return (
    <dl className={cn('grid gap-2', fields.length >= 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>
      {fields.map((field) => (
        <div key={field.label} className="min-w-0 rounded-md bg-surface-muted px-2 py-2 min-[360px]:px-3">
          <dt className="text-xs leading-4 break-words text-foreground-secondary">{field.label}</dt>
          <dd className={cn('mt-0.5 text-sm leading-5 font-semibold text-foreground tabular-nums', field.className)}>{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}
