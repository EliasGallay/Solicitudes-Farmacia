import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0', {
  variants: {
    variant: {
      default: 'bg-primary-600 text-white hover:bg-primary-700',
      secondary: 'border border-border bg-surface text-primary-600 hover:border-primary-100 hover:bg-primary-50',
      ghost: 'text-primary-600 hover:bg-primary-50',
      destructive: 'bg-danger text-white hover:bg-danger/90',
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3',
      lg: 'h-11 px-8',
      icon: 'size-10',
      'icon-sm': 'size-9',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
