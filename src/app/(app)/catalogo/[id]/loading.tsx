import { BackButton } from '@/components/back-button'
import { ProductDetailSkeleton } from '@/components/page-skeletons'

export default function Loading() {
  return (
    <>
      <BackButton fallback="/catalogo" />
      <ProductDetailSkeleton />
    </>
  )
}
