'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Vuelve a la ruta anterior; si la página se abrió directamente, usa `fallback`.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter()
  return (
    <Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}>
      <ArrowLeft />Volver
    </Button>
  )
}
