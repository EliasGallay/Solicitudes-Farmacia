import Link from 'next/link'
import { History, Pencil, Wrench } from 'lucide-react'
import { z } from 'zod'
import { toggleVehicle } from '@/app/fleet-actions'
import { BackButton } from '@/components/back-button'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { VehicleHistory, type VehicleRecord } from '@/components/fleet/vehicle-history'
import { VehicleNotFound } from '@/components/fleet/vehicle-not-found'
import { VehicleRecordForm } from '@/components/fleet/vehicle-record-form'
import { VehicleRequestStatusBadge } from '@/components/fleet/vehicle-request-status-badge'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { feedbackMessage } from '@/lib/feedback'
import { getEvidence, getEvidenceTypes } from '@/lib/fleet-evidence'
import { formatVehicleRequestNumber, type VehicleRecordKind, type VehicleRequestStatus } from '@/lib/fleet'
import { formatDate, relationOne } from '@/lib/requests'
import { requireFleetAccess } from '@/lib/session'

const UNKNOWN_ACTOR = 'usuario no disponible'

type RecordRow = {
  id: string; kind: VehicleRecordKind; description: string; performed_on: string; workshop: string; created_at: string; created_by: string
  voided_at: string | null; voided_by: string | null; void_reason: string | null
  request: { id: string; request_number: number } | { id: string; request_number: number }[] | null
}

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase, role, userId } = await requireFleetAccess()
  const isAdmin = role === 'admin'
  const id = z.string().uuid().safeParse((await params).id)
  const feedback = await searchParams
  if (!id.success) return <><BackButton fallback="/movilidad" /><VehicleNotFound /></>

  const [{ data: vehicle, error }, recordsResult, requestsResult, actorsResult] = await Promise.all([
    supabase.from('vehicles').select('id, name, brand, model, year, plate, internal_code, active').eq('id', id.data).maybeSingle(),
    supabase.from('vehicle_records')
      .select('id, kind, description, performed_on, workshop, created_at, created_by, voided_at, voided_by, void_reason, request:vehicle_requests(id, request_number)')
      .eq('vehicle_id', id.data).order('performed_on', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('vehicle_requests').select('id, request_number, description, created_at, status:vehicle_request_status')
      .eq('vehicle_id', id.data).in('vehicle_request_status', ['pending', 'purchase']).order('created_at', { ascending: false }),
    supabase.rpc('fleet_actor_names'),
  ])
  if (error || recordsResult.error || requestsResult.error) return <><BackButton fallback="/movilidad" /><Card><ErrorState title="No pudimos cargar el vehículo" /></Card></>
  if (!vehicle) return <><BackButton fallback="/movilidad" /><VehicleNotFound /></>

  const names = new Map(((actorsResult.data ?? []) as { user_id: string; full_name: string }[]).map((actor) => [actor.user_id, actor.full_name]))
  const actorName = (actorId: string | null) => (actorId && names.get(actorId)) || UNKNOWN_ACTOR
  const recordRows = (recordsResult.data ?? []) as RecordRow[]
  // Archivos de los registros y de las solicitudes que cerraron, en una sola consulta.
  const linkedRequestIds = recordRows.map((row) => relationOne(row.request)?.id).filter((requestId): requestId is string => Boolean(requestId))
  const [evidence, evidenceTypes] = await Promise.all([
    getEvidence(supabase, { recordIds: recordRows.map((row) => row.id), requestIds: linkedRequestIds }),
    getEvidenceTypes(supabase),
  ])
  const records: VehicleRecord[] = recordRows.map((row) => {
    const request = relationOne(row.request)
    const requestNote = request ? `de la solicitud ${formatVehicleRequestNumber(request.request_number)}` : undefined
    return {
      id: row.id,
      kind: row.kind,
      description: row.description,
      performedOn: row.performed_on,
      workshop: row.workshop,
      createdAt: row.created_at,
      createdBy: actorName(row.created_by),
      request: request ? { id: request.id, number: request.request_number } : null,
      voided: row.voided_at ? { at: row.voided_at, by: actorName(row.voided_by), reason: row.void_reason ?? '' } : null,
      evidence: [
        ...evidence.filter((item) => item.recordId === row.id),
        ...(request ? evidence.filter((item) => item.requestId === request.id).map((item) => ({ ...item, note: requestNote })) : []),
      ],
    }
  })
  const openRequests = (requestsResult.data ?? []) as { id: string; request_number: number; description: string; created_at: string; status: VehicleRequestStatus }[]
  const active = vehicle.active as boolean
  const internalCode = vehicle.internal_code as string | null

  return (
    <>
      <BackButton fallback="/movilidad" />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{internalCode ?? (vehicle.name as string)}{!active && <ProductStatusBadge active={false} />}</span>}
        description={[internalCode && (vehicle.name as string), `${vehicle.brand} ${vehicle.model}`, vehicle.year, vehicle.plate].filter(Boolean).join(' · ')}
        actions={(
          <div className="flex flex-wrap gap-3 max-sm:[&>*]:flex-1">
            {active && <Link href={`/movilidad/solicitudes/nueva?vehiculo=${id.data}`} className={buttonVariants()}><Wrench />Pedir reparación</Link>}
            {isAdmin && <Link href={`/movilidad/vehiculos/${id.data}/editar`} className={buttonVariants({ variant: 'secondary' })}><Pencil />Editar</Link>}
            {isAdmin && (
              <form action={toggleVehicle}>
                <input type="hidden" name="vehicle_id" value={id.data} />
                <input type="hidden" name="active" value={String(!active)} />
                <ConfirmSubmit
                  variant="secondary"
                  tone={active ? 'destructive' : 'default'}
                  title={active ? 'Desactivar el vehículo' : 'Reactivar el vehículo'}
                  description={active ? 'Deja de ofrecerse para solicitudes y registros nuevos; su historial se conserva. No se puede desactivar con solicitudes abiertas.' : 'Vuelve a ofrecerse para solicitudes y registros nuevos.'}
                >
                  {active ? 'Desactivar' : 'Reactivar'}
                </ConfirmSubmit>
              </form>
            )}
          </div>
        )}
      />
      {feedbackMessage(feedback.error) && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedback.error)}</FormError></div>}

      {openRequests.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Solicitudes abiertas</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {openRequests.map((request) => (
                <li key={request.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
                  <Link href={`/movilidad/solicitudes/${request.id}`} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">{formatVehicleRequestNumber(request.request_number)}</Link>
                  <VehicleRequestStatusBadge status={request.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground-secondary">{request.description}</span>
                  <span className="text-xs text-foreground-muted">{formatDate(request.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {active && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cargar en el historial</CardTitle>
            <CardDescription>Mantenimientos de rutina o reparaciones que no necesitaron una solicitud de servicio.</CardDescription>
          </CardHeader>
          <CardContent><VehicleRecordForm vehicleId={id.data} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
        {records.length === 0
          ? <EmptyState icon={History} title="Todavía no hay registros">Los mantenimientos y las reparaciones que se carguen van a aparecer acá.</EmptyState>
          : <CardContent><VehicleHistory vehicleId={id.data} records={records} canVoid={isAdmin} evidenceTypes={evidenceTypes} currentUserId={userId} actorName={actorName} /></CardContent>}
      </Card>
    </>
  )
}
