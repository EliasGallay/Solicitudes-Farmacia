import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav role="navigation" aria-label="Paginación" className={cn('flex', className)} {...props} />
}

export function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />
}

export function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />
}

type PaginationLinkProps = { isActive?: boolean; disabled?: boolean } & React.ComponentProps<typeof Link>

export function PaginationLink({ className, isActive, disabled, children, ...props }: PaginationLinkProps) {
  // Discreta: páginas como botón fantasma; la activa con fondo suave en lugar de color sólido.
  // En mobile crece a 40px para que sea cómoda al tacto.
  const classes = cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'max-sm:size-10', isActive ? 'bg-primary-100 text-primary-700 hover:bg-primary-100' : 'font-medium text-foreground-secondary hover:text-primary-600', className)
  if (disabled) return <span aria-disabled="true" aria-label={props['aria-label']} className={cn(classes, 'pointer-events-none opacity-50')}>{children}</span>
  return <Link aria-current={isActive ? 'page' : undefined} className={classes} {...props}>{children}</Link>
}

export function PaginationPrevious(props: Omit<PaginationLinkProps, 'children'>) {
  return <PaginationLink aria-label="Página anterior" {...props}><ChevronLeft /></PaginationLink>
}

export function PaginationNext(props: Omit<PaginationLinkProps, 'children'>) {
  return <PaginationLink aria-label="Página siguiente" {...props}><ChevronRight /></PaginationLink>
}

export function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return <span aria-hidden className={cn('flex size-8 items-center justify-center text-foreground-muted', className)} {...props}><Ellipsis className="size-4" /></span>
}
