import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => (
  <textarea className={cn('flex min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground sm:text-sm placeholder:text-foreground-muted focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-muted aria-invalid:border-danger', className)} ref={ref} {...props} />
))
Textarea.displayName = 'Textarea'
