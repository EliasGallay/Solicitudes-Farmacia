'use client'

import type { ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return <Button type="submit" disabled={pending}>{pending ? 'Guardando...' : children}</Button>
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <Alert variant="destructive" className="mt-4">{children}</Alert>
}

// Los resultados exitosos no van en una tarjeta: se muestran como toast (src/components/success-toast.tsx).
