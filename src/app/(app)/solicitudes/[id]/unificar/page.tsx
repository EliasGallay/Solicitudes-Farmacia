import Link from 'next/link'
import { GitMerge } from 'lucide-react'
import { z } from 'zod'
import { mergeRequests } from '@/app/request-management-actions'
import { BackButton } from '@/components/back-button'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { feedbackMessage } from '@/lib/feedback'
import { openStatuses } from '@/lib/request-status'
import { NOTE_MAX_LENGTH } from '@/lib/request-management'
import { formatDateTime, formatRequestNumber } from '@/lib/requests'
import { requireRole } from '@/lib/session'

type ItemRow = { requested_quantity: number; delivered_quantity: number; closed_quantity: number; pending_quantity: number }

// Sin entregas y con pendiente: la solicitud origen se puede unificar (la base lo vuelve a validar).
// Destino: pendiente, mismo centro y rubro, distinta de la origen.
export default async function MergeRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const { error: feedbackError } = await searchParams
  if (!id.success) return <><BackButton fallback="/solicitudes" /><Card><ErrorState title="No encontramos la solicitud" /></Card></>
  const detailHref = `/solicitudes/${id.data}`

  const { data: source, error } = await supabase.from('requests').select('id, area, health_center_id, request_number, request_status, request_items(requested_quantity, delivered_quantity, closed_quantity, pending_quantity)').eq('id', id.data).maybeSingle()
  if (error || !source) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>

  const sourceItems = (source.request_items ?? []) as ItemRow[]
  const sourcePending = sourceItems.reduce((total, item) => total + item.pending_quantity, 0)
  const sourceDelivered = sourceItems.reduce((total, item) => total + item.delivered_quantity, 0)
  const sourceMergeable = sourceDelivered === 0 && sourcePending > 0

  // Solicitudes abiertas del mismo centro y rubro, con pendiente.
  const { data: candidateRows, error: candidatesError } = sourceMergeable
    ? await supabase.from('requests').select('id, request_number, created_at, request_items(requested_quantity, delivered_quantity, closed_quantity, pending_quantity)')
        .eq('health_center_id', source.health_center_id as string)
        .eq('area', source.area as string)
        .neq('id', id.data)
        .in('request_status', openStatuses)
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  const candidates = (candidateRows ?? [])
    .map((row) => ({
      id: row.id as string,
      number: row.request_number as number,
      createdAt: row.created_at as string,
      pending: ((row.request_items ?? []) as ItemRow[]).reduce((total, item) => total + item.pending_quantity, 0),
    }))
    .filter((candidate) => candidate.pending > 0)

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title="Unificar solicitudes"
        description={<>Lo pendiente de <span className="font-semibold text-foreground">{formatRequestNumber(source.request_number as number)}</span> pasa a la solicitud que elijas y la de origen queda cerrada. Lo sumado queda en el historial de la solicitud destino.</>}
      />
      {feedbackError && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedbackError)}</FormError></div>}

      {!sourceMergeable ? (
        <Card><EmptyState icon={GitMerge} title="Esta solicitud no se puede unificar" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>{source.request_status === 'unified' ? 'Ya fue unificada con otra solicitud.' : sourceDelivered > 0 ? 'Ya tiene entregas registradas.' : 'No tiene nada pendiente.'}</EmptyState></Card>
      ) : candidatesError ? (
        <Card><ErrorState title="No pudimos cargar las solicitudes para unificar" /></Card>
      ) : candidates.length === 0 ? (
        <Card><EmptyState icon={GitMerge} title="No hay otra solicitud abierta" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>El centro no tiene otra solicitud pendiente de este rubro.</EmptyState></Card>
      ) : (
        <form action={mergeRequests}>
          <input type="hidden" name="source_id" value={id.data} />
          <Card>
            <CardHeader>
              <CardTitle>Solicitud destino</CardTitle>
              <CardDescription>Solo se listan solicitudes abiertas del mismo centro y rubro.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="unificar-destino">Unificar con</Label>
              <Select name="target_id" required>
                <SelectTrigger id="unificar-destino"><SelectValue placeholder="Seleccionar solicitud" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {formatRequestNumber(candidate.number)} · {formatDateTime(candidate.createdAt)} · {candidate.pending} pendientes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>Motivo</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="unificar-motivo">Motivo <span className="font-normal text-foreground-secondary">(obligatorio)</span></Label>
              <Textarea id="unificar-motivo" name="reason" required maxLength={NOTE_MAX_LENGTH} placeholder="Por ejemplo: el centro cargó productos que faltaban en la primera solicitud." />
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
            <ConfirmSubmit variant="default" title="Unificar solicitudes" description="Lo pendiente de la solicitud de origen se suma a la destino y la de origen queda cerrada. No se puede deshacer desde esta pantalla y el motivo queda en el historial de ambas.">
              <GitMerge />Unificar
            </ConfirmSubmit>
          </div>
        </form>
      )}
    </>
  )
}
