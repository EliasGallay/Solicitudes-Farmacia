'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from './empty-state'

export function ErrorState({ title = 'No pudimos cargar la información', description = 'Intentá nuevamente en unos instantes.' }: { title?: string; description?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div role="alert">
      <EmptyState icon={CircleAlert} tone="danger" title={title} action={<Button variant="secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RotateCw />{pending ? 'Reintentando...' : 'Reintentar'}</Button>}>
        {description}
      </EmptyState>
    </div>
  )
}
