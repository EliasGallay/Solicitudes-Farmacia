import Link from 'next/link'
import { Ban, CircleCheck, ClipboardX, ShoppingCart } from 'lucide-react'
import { z } from 'zod'
import { cancelVehicleRequest, setVehiclePurchaseRequirement } from '@/app/fleet-actions'
import { BackButton } from '@/components/back-button'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { EvidenceList } from '@/components/fleet/evidence-list'
import { EvidenceUploadForm } from '@/components/fleet/evidence-upload-form'
import { VehicleRecordForm } from '@/components/fleet/vehicle-record-form'
import { VehicleRequestStatusBadge } from '@/components/fleet/vehicle-request-status-badge'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { PurchaseRequirementCard } from '@/components/requests/purchase-requirement'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { feedbackMessage } from '@/lib/feedback'
import { getEvidence, getEvidenceTypes } from '@/lib/fleet-evidence'
import { formatVehicleRequestNumber, openVehicleRequestStatuses, vehicleLabel, type VehicleRequestStatus } from '@/lib/fleet'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'
import { formatDate, formatDateTime, relationOne } from '@/lib/requests'
import { requireFleetAccess } from '@/lib/session'

const UNKNOWN_ACTOR = 'usuario no disponible'
const REQUIREMENT_HINT = 'Si hay que pedirlo a compras, anotá el número de requerimiento: la solicitud queda «En compras» hasta que se complete.'

type VehicleRelation = { id: string; name: string; plate: string; internal_code: string | null; active: boolean }

export default async function VehicleRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, role, userId } = await requireFleetAccess()
  const isAdmin = role === 'admin'
  const id = z.string().uuid().safeParse((await params).id)
  const feedback = await searchParams
  if (!id.success) return <><BackButton fallback="/movilidad/solicitudes" /><RequestNotFound /></>

  const [{ data, error }, recordResult, actorsResult] = await Promise.all([
    supabase.from('vehicle_requests')
      .select('id, request_number, description, created_at, created_by, purchase_requirement_number, purchase_requirement_at, purchase_requirement_by, cancelled_at, cancelled_by, cancel_reason, status:vehicle_request_status, vehicle:vehicles(id, name, plate, internal_code, active)')
      .eq('id', id.data).maybeSingle(),
    // El registro activo que la cerró (a lo sumo uno).
    supabase.from('vehicle_records').select('description, performed_on, workshop, created_at, created_by').eq('vehicle_request_id', id.data).is('voided_at', null).maybeSingle(),
    supabase.rpc('fleet_actor_names'),
  ])
  if (error || recordResult.error) return <><BackButton fallback="/movilidad/solicitudes" /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>
  if (!data) return <><BackButton fallback="/movilidad/solicitudes" /><RequestNotFound /></>

  // Archivos de la solicitud (en cualquier estado) y tipos de documento para adjuntar.
  const [evidence, evidenceTypes] = await Promise.all([getEvidence(supabase, { requestIds: [id.data] }), getEvidenceTypes(supabase)])
  const names = new Map(((actorsResult.data ?? []) as { user_id: string; full_name: string }[]).map((actor) => [actor.user_id, actor.full_name]))
  const actorName = (actorId: unknown) => (typeof actorId === 'string' && names.get(actorId)) || UNKNOWN_ACTOR
  const status = data.status as VehicleRequestStatus
  const open = openVehicleRequestStatuses.includes(status)
  const vehicle = relationOne(data.vehicle as VehicleRelation | VehicleRelation[] | null)
  const record = recordResult.data
  const requirement = data.purchase_requirement_number
    ? { number: data.purchase_requirement_number as string, at: data.purchase_requirement_at as string, by: actorName(data.purchase_requirement_by) }
    : null

  return (
    <>
      <BackButton fallback="/movilidad/solicitudes" />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Solicitud {formatVehicleRequestNumber(data.request_number as number)}<VehicleRequestStatusBadge status={status} /></span>}
        description={<>Pedida por {actorName(data.created_by)} el {formatDateTime(data.created_at as string)}</>}
      />
      {feedbackMessage(feedback.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedback.error)}</FormError></div>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            {vehicle ? <Link href={`/movilidad/vehiculos/${vehicle.id}`} className="text-primary-600 hover:text-primary-700 hover:underline">{vehicleLabel(vehicle)}</Link> : 'Vehículo no disponible'}
          </CardTitle>
          <CardDescription>Qué necesita</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm whitespace-pre-line break-words">{data.description as string}</p></CardContent>
      </Card>

      {open && isAdmin && <PurchaseRequirementCard requestId={id.data} requirement={requirement} action={setVehiclePurchaseRequirement} hint={REQUIREMENT_HINT} />}
      {requirement && !(open && isAdmin) && (
        <Card className="mb-6 flex gap-3 p-4 text-sm sm:p-5">
          <ShoppingCart className="size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">Requerimiento de compra N° <span className="tabular-nums">{requirement.number}</span></p>
            <p className="mt-1 text-foreground-secondary">Registrado por {requirement.by} el {formatDateTime(requirement.at)}.</p>
          </div>
        </Card>
      )}

      {status === 'completed' && record && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleCheck className="size-5 text-success" aria-hidden />Qué se reparó</CardTitle>
            <CardDescription>Cargado por {actorName(record.created_by)} el {formatDateTime(record.created_at as string)}. Quedó en el historial del vehículo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="whitespace-pre-line break-words">{record.description as string}</p>
            <p className="text-foreground-secondary">{formatDate(`${record.performed_on as string}T12:00:00Z`)} · {record.workshop as string}</p>
          </CardContent>
        </Card>
      )}

      {status === 'cancelled' && (
        <Card className="mb-6 flex gap-3 p-4 text-sm sm:p-5">
          <Ban className="size-5 shrink-0 text-foreground-secondary" aria-hidden />
          <div>
            <p className="font-semibold">Cancelada por {actorName(data.cancelled_by)} el {formatDateTime(data.cancelled_at as string)}</p>
            <p className="mt-1 whitespace-pre-line text-foreground-secondary">{data.cancel_reason as string}</p>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Archivos</CardTitle>
          <CardDescription>Presupuesto, factura, fotos y la documentación que haga falta. Se pueden adjuntar en cualquier momento.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <EvidenceList items={evidence} actorName={actorName} currentUserId={userId} isAdmin={isAdmin} returnTo={`/movilidad/solicitudes/${id.data}`} />
          <details className="group rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold text-primary-600 hover:text-primary-700">Adjuntar archivos</summary>
            <div className="mt-4"><EvidenceUploadForm target={{ kind: 'request', id: id.data }} types={evidenceTypes} /></div>
          </details>
        </CardContent>
      </Card>

      {open && (vehicle?.active ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Completar</CardTitle>
            <CardDescription>Cuando el vehículo vuelve, cargá qué se reparó, cuándo y dónde. Queda en el historial del vehículo y la solicitud se cierra.</CardDescription>
          </CardHeader>
          <CardContent><VehicleRecordForm requestId={id.data} /></CardContent>
        </Card>
      ) : (
        <Card className="mb-6 p-4 text-sm text-foreground-secondary sm:p-5">El vehículo está desactivado: la solicitud ya no se puede completar, solo cancelar.</Card>
      ))}

      {open && (
        <Card>
          <CardHeader>
            <CardTitle>Cancelar la solicitud</CardTitle>
            <CardDescription>Si ya no hace falta. Queda registrada como cancelada, con el motivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={cancelVehicleRequest} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="request_id" value={id.data} />
              <Input name="reason" required maxLength={NOTE_MAX_LENGTH} aria-label="Motivo de la cancelación" placeholder="Motivo de la cancelación" className="min-w-0 flex-1" />
              <ConfirmSubmit variant="secondary" tone="destructive" title="Cancelar la solicitud" description="La solicitud queda cancelada y ya no se puede completar." confirmLabel="Cancelar solicitud">Cancelar solicitud</ConfirmSubmit>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function RequestNotFound() {
  return (
    <Card>
      <EmptyState icon={ClipboardX} title="No encontramos la solicitud" action={<Link href="/movilidad/solicitudes" className={buttonVariants({ variant: 'secondary' })}>Volver a las solicitudes</Link>}>
        Puede que el enlace sea incorrecto.
      </EmptyState>
    </Card>
  )
}
