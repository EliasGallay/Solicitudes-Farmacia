import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex min-h-7 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    variant: {
      neutral: 'bg-surface-muted text-foreground-secondary',
      warning: 'bg-warning-muted text-warning',
      info: 'bg-info-muted text-info',
      success: 'bg-success-muted text-success',
      danger: 'bg-danger-muted text-danger',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
