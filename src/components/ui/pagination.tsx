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
  const classes = cn(buttonVariants({ variant: isActive ? 'default' : 'secondary', size: 'icon-sm' }), className)
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
  return <span aria-hidden className={cn('flex size-9 items-center justify-center text-foreground-secondary', className)} {...props}><Ellipsis className="size-4" /></span>
}
