import Link from 'next/link'
import { GitMerge } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatDateTime, formatRequestNumber } from '@/lib/requests'

// Una fila de request_merges, con el número de cada solicitud ya resuelto.
export type RequestMerge = { sourceId: string; sourceNumber: number; targetId: string; targetNumber: number; reason: string; createdAt: string }

// Registro de unificaciones de la solicitud: si es origen (apunta a la destino) y si recibió
// lo pendiente de otras (lista las origen). Viene de request_merges, nunca se edita desde acá.
export function RequestMergesCard({ requestId, merges }: { requestId: string; merges: RequestMerge[] }) {
  const asSource = merges.find((merge) => merge.sourceId === requestId)
  const asTarget = merges.filter((merge) => merge.targetId === requestId)
  if (!asSource && asTarget.length === 0) return null

  return (
    <Card className="mb-6 flex flex-col gap-3 p-4 sm:p-5">
      {asSource && (
        <p className="flex items-start gap-2 text-sm">
          <GitMerge className="mt-0.5 size-4 shrink-0 text-foreground-secondary" aria-hidden />
          <span>
            Unificada con{' '}
            <Link href={`/solicitudes/${asSource.targetId}`} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(asSource.targetNumber)}</Link>
            {' '}el {formatDateTime(asSource.createdAt)}. Motivo: <span className="text-foreground-secondary">{asSource.reason}</span>
          </span>
        </p>
      )}
      {asTarget.length > 0 && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="flex items-center gap-2 font-semibold"><GitMerge className="size-4 shrink-0 text-foreground-secondary" aria-hidden />Se unificaron acá</p>
          <ul className="flex flex-col gap-1 pl-6">
            {asTarget.map((merge) => (
              <li key={merge.sourceId}>
                <Link href={`/solicitudes/${merge.sourceId}`} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(merge.sourceNumber)}</Link>
                {' '}el {formatDateTime(merge.createdAt)}. Motivo: <span className="text-foreground-secondary">{merge.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
