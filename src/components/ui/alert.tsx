import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: { variant: { default: 'border-border bg-surface text-foreground', destructive: 'border-danger/30 bg-danger-muted text-danger', success: 'border-success/30 bg-success-muted text-success' } },
  defaultVariants: { variant: 'default' },
})

export function Alert({ className, variant, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
