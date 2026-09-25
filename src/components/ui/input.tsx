import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn('flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground sm:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-foreground-muted focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-muted aria-invalid:border-danger', className)} ref={ref} {...props} />
))
Input.displayName = 'Input'
