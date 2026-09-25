import type { ReactNode } from 'react'

// Acento verde a la izquierda del título y la descripción. En mobile las acciones pasan
// debajo del título y ocupan todo el ancho.
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-4">
        <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-primary-600" />
        <div className="min-w-0">
          <h1 className="text-2xl leading-8 font-bold tracking-tight break-words text-foreground sm:text-3xl sm:leading-10">{title}</h1>
          {description && <div className="mt-2 text-sm leading-5 text-foreground-secondary sm:text-base sm:leading-6">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3 max-sm:[&>*]:flex-1">{actions}</div>}
    </div>
  )
}
