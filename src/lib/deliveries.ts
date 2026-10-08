import { relationOne } from './requests'
import type { createSupabaseServerClient } from './supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

type Named = { full_name: string } | { full_name: string }[] | null
type ProductRelation = { name: string; presentation: string } | { name: string; presentation: string }[] | null
type ItemRelation = { requested_quantity: number; product: ProductRelation } | { requested_quantity: number; product: ProductRelation }[] | null
type CenterRelation = { name: string } | { name: string }[] | null
type RequestRow = { id: string; request_number: number; area: string; health_center_id: string; created_at: string; creator: Named; health_center: CenterRelation }
type RequestRelation = RequestRow | RequestRow[] | null

export type DeliveryDetail = {
  id: string
  number: number
  createdAt: string
  createdBy: string
  // Id de quien entregó: el solicitante no lee perfiles ajenos y resuelve el nombre con request_actor_names.
  createdById: string
  note: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  request: { id: string; number: number; area: string; healthCenterId: string; centerName: string | null; createdAt: string; createdBy: string | null }
  // `receipt`: lo que confirmó el centro para esa línea (null si todavía no la confirmó).
  items: { id: string; name: string; presentation: string; requested: number; quantity: number; receipt: LineReceipt | null }[]
}

// `confirmedBy`: id de quien confirmó (el nombre sale de request_actor_names).
export type LineReceipt = { received: number; comment: string | null; resolution: 'reenviar' | 'cerrar' | null; confirmedAt: string; confirmedBy: string }
type ReceiptRow = { received_quantity: number; comment: string | null; resolution: 'reenviar' | 'cerrar' | null; created_at: string; created_by: string }
type ReceiptRelation = ReceiptRow | ReceiptRow[] | null

// Estado de recepción de una entrega según sus líneas (supabase/migrations/202610040001_delivery_receipts.sql).
export type ReceiptState = 'sin_confirmar' | 'parcial' | 'con_diferencia' | 'recibida'

export function receiptState(lines: { quantity: number; receipt: Pick<LineReceipt, 'received' | 'resolution'> | null }[]): ReceiptState {
  if (lines.some((line) => line.receipt && line.receipt.received < line.quantity && !line.receipt.resolution)) return 'con_diferencia'
  const confirmed = lines.filter((line) => line.receipt).length
  if (confirmed === 0) return 'sin_confirmar'
  return confirmed < lines.length ? 'parcial' : 'recibida'
}

// Entrega con su solicitud y productos, para el detalle (/entregas/[id]), el remito (/remitos/[id]) y la
// constancia de recepción (/recepciones/[id]).
// null si no existe o no es visible; lanza ante un error de la consulta.
export async function getDelivery(supabase: SupabaseClient, id: string): Promise<DeliveryDetail | null> {
  const { data, error } = await supabase
    .from('deliveries')
    // deliveries tiene dos FK a profiles (quien entrega y quien anula): se nombran explícitamente.
    .select('id, delivery_number, created_at, created_by, note, voided_at, void_reason, creator:profiles!deliveries_created_by_fkey(full_name), voider:profiles!deliveries_voided_by_fkey(full_name), request:requests(id, request_number, area, health_center_id, created_at, creator:profiles(full_name), health_center:health_centers(name)), delivery_items(id, current_quantity, receipt:delivery_item_receipts(received_quantity, comment, resolution, created_at, created_by), request_item:request_items(requested_quantity, product:products(name, presentation)))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const request = relationOne(data.request as RequestRelation)
  if (!request) return null
  const items = ((data.delivery_items ?? []) as { id: string; current_quantity: number; receipt: ReceiptRelation; request_item: ItemRelation }[]).map((line) => {
    const item = relationOne(line.request_item)
    const product = relationOne(item?.product ?? null)
    const receipt = relationOne(line.receipt)
    return {
      id: line.id,
      name: product?.name ?? 'Producto no disponible',
      presentation: product?.presentation ?? '—',
      requested: item?.requested_quantity ?? 0,
      quantity: line.current_quantity,
      receipt: receipt ? { received: receipt.received_quantity, comment: receipt.comment, resolution: receipt.resolution, confirmedAt: receipt.created_at, confirmedBy: receipt.created_by } : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return {
    id: data.id as string,
    number: data.delivery_number as number,
    createdAt: data.created_at as string,
    createdBy: relationOne(data.creator as Named)?.full_name ?? '—',
    createdById: data.created_by as string,
    note: data.note as string | null,
    voidedAt: data.voided_at as string | null,
    voidedBy: data.voided_at ? relationOne(data.voider as Named)?.full_name ?? '—' : null,
    voidReason: data.void_reason as string | null,
    request: { id: request.id, number: request.request_number, area: request.area, healthCenterId: request.health_center_id, centerName: relationOne(request.health_center)?.name ?? null, createdAt: request.created_at, createdBy: relationOne(request.creator)?.full_name ?? null },
    items,
  }
}
