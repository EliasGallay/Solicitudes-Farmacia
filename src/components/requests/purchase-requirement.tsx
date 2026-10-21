import { ShoppingCart } from 'lucide-react'
import { setPurchaseRequirement } from '@/app/request-management-actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PURCHASE_REQUIREMENT_MAX_LENGTH } from '@/lib/request-management'
import { formatDateTime } from '@/lib/requests'

export type PurchaseRequirement = { number: string; at: string; by: string }

// Requerimiento de compra en el detalle (solo admin, mientras haya pendiente): registrar el número
// que dio el sistema de compras o corregirlo. El mismo número puede ir en varias solicitudes.
export function PurchaseRequirementCard({ requestId, requirement }: { requestId: string; requirement: PurchaseRequirement | null }) {
  return (
    <Card className="mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between sm:p-5">
      <div className="flex gap-3 text-sm">
        <ShoppingCart className="size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-semibold">
            {requirement ? <>Requerimiento de compra N° <span className="tabular-nums">{requirement.number}</span></> : 'Requerimiento de compra'}
          </p>
          <p className="mt-1 text-foreground-secondary">
            {requirement
              ? `Registrado por ${requirement.by} el ${formatDateTime(requirement.at)}.`
              : 'Si hay que pedirlo a compras, anotá el número de requerimiento: la solicitud queda «En compras» hasta la primera entrega.'}
          </p>
        </div>
      </div>
      <form action={setPurchaseRequirement} className="flex shrink-0 gap-2">
        <input type="hidden" name="request_id" value={requestId} />
        <Input name="requirement_number" required maxLength={PURCHASE_REQUIREMENT_MAX_LENGTH} defaultValue={requirement?.number} aria-label="Número de requerimiento de compra" placeholder="N° de requerimiento" className="min-w-0 flex-1 lg:w-44" />
        <Button type="submit" variant={requirement ? 'secondary' : 'default'}>{requirement ? 'Corregir' : 'Registrar'}</Button>
      </form>
    </Card>
  )
}
