import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">{children}</div>
}
