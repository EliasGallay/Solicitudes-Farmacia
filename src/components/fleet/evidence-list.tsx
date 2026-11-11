import { FileText, Image as ImageIcon } from 'lucide-react'
import { deleteFleetEvidence } from '@/app/fleet-actions'
import { ConfirmSubmit } from '@/components/confirm-submit'
import type { Evidence } from '@/lib/fleet-evidence'
import { formatDateTime } from '@/lib/requests'

// Archivos adjuntos con tipo, nombre (abre el archivo), quién y cuándo. «Borrar» aparece para quien lo
// subió y para el admin; el borrado es lógico (la base lo valida igual). `note`: de dónde viene el
// archivo cuando se muestra fuera de su lugar (p. ej. los de la solicitud en el registro que la cerró).
export function EvidenceList({ items, actorName, currentUserId, isAdmin, returnTo }: { items: (Evidence & { note?: string })[]; actorName: (userId: string) => string; currentUserId: string; isAdmin: boolean; returnTo: string }) {
  if (items.length === 0) return <p className="text-sm text-foreground-secondary">Sin archivos.</p>
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((item) => {
        const Icon = item.isPdf ? FileText : ImageIcon
        return (
          <li key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
            <Icon className="hidden size-5 shrink-0 text-foreground-secondary sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{item.typeLabel}</span>
                {' · '}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary-600 hover:text-primary-700 hover:underline">{item.name}</a>
              </p>
              <p className="mt-0.5 text-xs leading-4 text-foreground-secondary">
                {actorName(item.createdById)} · {formatDateTime(item.createdAt)}{item.note && ` · ${item.note}`}
              </p>
            </div>
            {(isAdmin || item.createdById === currentUserId) && (
              <form action={deleteFleetEvidence}>
                <input type="hidden" name="evidence_id" value={item.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <ConfirmSubmit size="sm" tone="destructive" title="Borrar el archivo" description={`«${item.name}» deja de verse. Queda registrado quién lo borró y cuándo.`} confirmLabel="Borrar">Borrar</ConfirmSubmit>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}
