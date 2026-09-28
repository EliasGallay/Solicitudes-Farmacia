import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('motion-safe:animate-breath rounded-md bg-surface-muted', className)} {...props} />
}
