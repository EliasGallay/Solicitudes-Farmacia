import { BackButton } from '@/components/back-button'
import { RequestDetailSkeleton } from '@/components/page-skeletons'

export default function Loading() {
  return (
    <>
      <BackButton fallback="/solicitudes" />
      <RequestDetailSkeleton />
    </>
  )
}
