import type { createSupabaseServerClient } from './supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

// Remitos firmados por el centro, que adjunta el admin al confirmar la recepción
// (supabase/migrations/202610230002_signed_delivery_notes.sql). Los límites coinciden con el bucket.
export const SIGNED_NOTES_BUCKET = 'remitos-firmados'
export const SIGNED_NOTE_MAX_BYTES = 5 * 1024 * 1024
export const signedNoteTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as const
export type SignedNoteType = keyof typeof signedNoteTypes

export function isSignedNoteType(type: string): type is SignedNoteType {
  return Object.hasOwn(signedNoteTypes, type)
}

// La carpeta es la entrega: la RPC rechaza un archivo de otra entrega. El nombre es aleatorio (no se
// guarda el nombre original del archivo).
export function signedNotePath(deliveryId: string, type: SignedNoteType, fileId: string = crypto.randomUUID()) {
  return `${deliveryId}/${fileId}.${signedNoteTypes[type]}`
}

// `url`: enlace firmado temporal (el bucket es privado); null si no se pudo generar.
export type SignedNote = { id: string; deliveryId: string; url: string | null; isPdf: boolean; createdAt: string; createdBy: string }

const URL_TTL_SECONDS = 60 * 60

// Remitos firmados de una solicitud o de una entrega, con su enlace. Si la consulta falla (p. ej. la
// migración todavía no está aplicada) devuelve [] para no romper la pantalla.
export async function getSignedNotes(supabase: SupabaseClient, filter: { requestId: string } | { deliveryId: string }): Promise<SignedNote[]> {
  const query = supabase.from('delivery_signed_notes').select('id, delivery_id, storage_path, content_type, created_at, created_by').order('created_at')
  const { data, error } = await ('requestId' in filter ? query.eq('request_id', filter.requestId) : query.eq('delivery_id', filter.deliveryId))
  if (error || !data?.length) return []

  const rows = data as { id: string; delivery_id: string; storage_path: string; content_type: string; created_at: string; created_by: string }[]
  const { data: urls } = await supabase.storage.from(SIGNED_NOTES_BUCKET).createSignedUrls(rows.map((row) => row.storage_path), URL_TTL_SECONDS)
  const byPath = new Map((urls ?? []).map((entry) => [entry.path, entry.signedUrl]))
  return rows.map((row) => ({
    id: row.id,
    deliveryId: row.delivery_id,
    url: byPath.get(row.storage_path) || null,
    isPdf: row.content_type === 'application/pdf',
    createdAt: row.created_at,
    createdBy: row.created_by,
  }))
}
