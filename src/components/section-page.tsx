import type { ReactNode } from 'react'
import { AppShell } from './app-shell'

export function SectionPage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
        {children}
      </div>
    </AppShell>
  )
}
