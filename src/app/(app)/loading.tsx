import { DashboardSkeleton, PageHeaderSkeleton } from '@/components/page-skeletons'

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <DashboardSkeleton />
    </>
  )
}
