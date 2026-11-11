import Link from 'next/link'
import { voidVehicleRecord } from '@/app/fleet-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EvidenceList } from '@/components/fleet/evidence-list'
import { EvidenceUploadForm } from '@/components/fleet/evidence-upload-form'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { Evidence, EvidenceDocumentType } from '@/lib/fleet-evidence'
import { formatVehicleRequestNumber, vehicleRecordKindLabels, type VehicleRecordKind } from '@/lib/fleet'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'
import { formatDate, formatDateTime } from '@/lib/requests'
import { cn } from '@/lib/utils'

export type VehicleRecord = {
  id: string
  kind: VehicleRecordKind
  description: string
  performedOn: string
  workshop: string
  createdAt: string
  createdBy: string
  request: { id: string; number: number } | null
  voided: { at: string; by: string; reason: string } | null
  // Archivos del registro y, si cerró una solicitud, también los de la solicitud (con `note`).
  evidence: (Evidence & { note?: string })[]
}

// Línea de tiempo del historial del vehículo, de lo más reciente a lo más antiguo. Los anulados se
// muestran tachados con su motivo. `canVoid`: el admin anula con motivo (si cerró una solicitud, se
// reabre).
// Cada registro lista sus archivos y permite adjuntar más, aunque esté anulado.
export function VehicleHistory({ vehicleId, records, canVoid, evidenceTypes, currentUserId, actorName }: { vehicleId: string; records: VehicleRecord[]; canVoid: boolean; evidenceTypes: EvidenceDocumentType[]; currentUserId: string; actorName: (userId: string) => string }) {
  return (
    <ol className="flex flex-col">
      {records.map((record) => (
        <li key={record.id} className="relative border-l-2 border-border pb-6 pl-5 last:pb-0">
          <span className={cn('absolute top-1 -left-[7px] size-3 rounded-full border-2 border-surface', record.voided ? 'bg-border-strong' : record.kind === 'repair' ? 'bg-warning' : 'bg-primary-500')} aria-hidden />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold tabular-nums">{formatDate(`${record.performedOn}T12:00:00Z`)}</span>
            <Badge variant={record.kind === 'repair' ? 'warning' : 'info'}>{vehicleRecordKindLabels[record.kind]}</Badge>
            {record.voided && <Badge variant="neutral" className="border border-border-strong text-foreground">Anulado</Badge>}
            {record.request && <Link href={`/movilidad/solicitudes/${record.request.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline">{formatVehicleRequestNumber(record.request.number)}</Link>}
          </div>
          <p className={cn('mt-1 text-sm whitespace-pre-line break-words', record.voided && 'text-foreground-muted line-through')}>{record.description}</p>
          <p className="mt-1 text-xs leading-4 text-foreground-secondary">En {record.workshop} · Cargado por {record.createdBy} el {formatDateTime(record.createdAt)}</p>
          {record.voided && <p className="mt-1 text-xs leading-4 text-foreground-secondary">Anulado por {record.voided.by} el {formatDateTime(record.voided.at)}: {record.voided.reason}</p>}
          {record.evidence.length > 0 && (
            <div className="mt-3 rounded-lg border border-border p-3">
              <EvidenceList items={record.evidence} actorName={actorName} currentUserId={currentUserId} isAdmin={canVoid} returnTo={`/movilidad/vehiculos/${vehicleId}`} />
            </div>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary-600 hover:text-primary-700">Adjuntar archivos</summary>
            <div className="mt-2 rounded-lg border border-border p-3"><EvidenceUploadForm target={{ kind: 'record', id: record.id }} types={evidenceTypes} /></div>
          </details>
          {canVoid && !record.voided && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-foreground-secondary hover:text-foreground">Anular registro</summary>
              <form action={voidVehicleRecord} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="vehicle_id" value={vehicleId} />
                <input type="hidden" name="record_id" value={record.id} />
                <Input name="reason" required maxLength={NOTE_MAX_LENGTH} aria-label="Motivo de la anulación" placeholder="Motivo de la anulación" className="min-w-0 flex-1" />
                <ConfirmSubmit
                  variant="secondary"
                  tone="destructive"
                  title="Anular el registro"
                  description={record.request ? `Queda visible como anulado y la solicitud ${formatVehicleRequestNumber(record.request.number)} vuelve a estar abierta.` : 'Queda visible como anulado en el historial.'}
                >
                  Anular
                </ConfirmSubmit>
              </form>
            </details>
          )}
        </li>
      ))}
    </ol>
  )
}
