import { PageHeaderSkeleton, RequestListSkeleton } from '@/components/page-skeletons'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <Card className="mb-6 p-4"><Skeleton className="h-16 w-full" /></Card>
      <Card><RequestListSkeleton rows={10} /></Card>
    </>
  )
}
