import type { ReactNode } from 'react'
import { PageHeader } from './page-header'

export function SectionPage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {children}
    </>
  )
}
