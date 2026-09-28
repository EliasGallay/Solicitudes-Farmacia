import Link from 'next/link'
import { PackageCheck } from 'lucide-react'
import { z } from 'zod'
import { closePending } from '@/app/request-management-actions'
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
import { closureReasonLabels, closureReasons, NOTE_MAX_LENGTH } from '@/lib/request-management'
import { formatRequestNumber, relationOne } from '@/lib/requests'
import { requireRole } from '@/lib/session'

type ItemRow = { id: string; requested_quantity: number; delivered_quantity: number; pending_quantity: number; product: { name: string; presentation: string } | { name: string; presentation: string }[] | null }

export default async function ClosePendingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requireRole('admin')
  const id = z.string().uuid().safeParse((await params).id)
  const { error: feedbackError } = await searchParams
  if (!id.success) return <><BackButton fallback="/solicitudes" /><Card><ErrorState title="No encontramos la solicitud" /></Card></>
  const detailHref = `/solicitudes/${id.data}`

  const { data: request, error } = await supabase.from('requests').select('id, request_number, request_items(id, requested_quantity, delivered_quantity, pending_quantity, product:products(name, presentation))').eq('id', id.data).maybeSingle()
  if (error || !request) return <><BackButton fallback={detailHref} /><Card><ErrorState title="No pudimos cargar la solicitud" /></Card></>

  const items = ((request.request_items ?? []) as ItemRow[])
    .filter((item) => item.pending_quantity > 0)
    .map((item) => ({ id: item.id, product: relationOne(item.product), requested: item.requested_quantity, delivered: item.delivered_quantity, pending: item.pending_quantity }))
    .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'es'))

  return (
    <>
      <BackButton fallback={detailHref} />
      <PageHeader
        title="Cerrar pendiente"
        description={<>Solicitud <Link href={detailHref} className="font-semibold text-primary-600 hover:underline">{formatRequestNumber(request.request_number as number)}</Link>. Lo cerrado <span className="font-semibold text-foreground">no se va a entregar</span> y deja de figurar como pendiente.</>}
      />
      {feedbackError && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(feedbackError)}</FormError></div>}

      {items.length === 0 ? (
        <Card><EmptyState icon={PackageCheck} title="No hay nada pendiente" action={<Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Volver a la solicitud</Link>}>Todos los productos se entregaron o se cerraron.</EmptyState></Card>
      ) : (
        <form action={closePending}>
          <input type="hidden" name="request_id" value={id.data} />
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              <CardDescription>Se cierra todo lo pendiente de los productos marcados. Lo ya entregado no cambia.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-primary-50">
                      <input type="checkbox" name="item" value={item.id} defaultChecked className="size-4 shrink-0 accent-primary-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold break-words">{item.product?.name ?? 'Producto no disponible'}</span>
                        <span className="block text-xs text-foreground-secondary">{item.product?.presentation ?? '—'} · Solicitado {item.requested} · Entregado {item.delivered}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg leading-6 font-bold text-warning tabular-nums">{item.pending}</span>
                        <span className="text-xs text-foreground-secondary">a cerrar</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>Motivo</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[16rem_1fr]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cierre-motivo">Motivo</Label>
                <Select name="reason" required>
                  <SelectTrigger id="cierre-motivo"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{closureReasons.map((reason) => <SelectItem key={reason} value={reason}>{closureReasonLabels[reason]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cierre-detalle">Detalle <span className="font-normal text-foreground-secondary">(obligatorio si el motivo es «Otro»)</span></Label>
                <Textarea id="cierre-detalle" name="detail" maxLength={NOTE_MAX_LENGTH} placeholder="Se muestra en el historial de la solicitud, también al solicitante." />
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link href={detailHref} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
            <ConfirmSubmit variant="destructive" title="Cerrar pendiente" description="Lo pendiente de los productos marcados deja de figurar en la solicitud y ya no se va a entregar. El motivo queda en el historial.">Cerrar pendiente</ConfirmSubmit>
          </div>
        </form>
      )}
    </>
  )
}
