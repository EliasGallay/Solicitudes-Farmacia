import { z } from 'zod'
import type { createSupabaseServerClient } from './supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

// Archivos de evidencia de Movilidad (supabase/migrations/202610290001_fleet_evidence.sql). Los límites
// coinciden con el bucket y con los checks de fleet_evidence.
export const FLEET_EVIDENCE_BUCKET = 'movilidad-evidencias'
export const FLEET_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024
export const EVIDENCE_OTHER_MAX = 60
export const EVIDENCE_NAME_MAX = 200
export const OTHER_DOCUMENT_TYPE = 'other'

export const evidenceContentTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as const
export type EvidenceContentType = keyof typeof evidenceContentTypes

export function isEvidenceContentType(type: string): type is EvidenceContentType {
  return Object.hasOwn(evidenceContentTypes, type)
}

// Un archivo es de una solicitud de servicio o de un registro del historial.
export type EvidenceTarget = { kind: 'request' | 'record'; id: string }

const targetFolders: Record<EvidenceTarget['kind'], string> = { request: 'solicitudes', record: 'registros' }

// La carpeta es el destino (la RPC rechaza una ruta de otra carpeta). El nombre es aleatorio; el original
// se guarda aparte para mostrarlo.
export function evidencePath(target: EvidenceTarget, contentType: EvidenceContentType, fileId: string = crypto.randomUUID()) {
  return `${targetFolders[target.kind]}/${target.id}/${fileId}.${evidenceContentTypes[contentType]}`
}

export function evidenceName(name: string) {
  return (name.trim() || 'archivo').slice(0, EVIDENCE_NAME_MAX)
}

// Tipo de documento: «Otro» pide un texto; en los demás el texto se descarta.
export const evidenceTypeSchema = z.object({
  document_type: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Elegí el tipo de documento').max(50),
  document_type_other: z.string(),
}).transform((values, ctx) => {
  if (values.document_type !== OTHER_DOCUMENT_TYPE) return { document_type: values.document_type, document_type_other: null }
  const other = values.document_type_other.trim()
  if (other.length === 0 || other.length > EVIDENCE_OTHER_MAX) {
    ctx.addIssue({ code: 'custom', path: ['document_type_other'], message: `Escribí qué documento es (hasta ${EVIDENCE_OTHER_MAX} caracteres)` })
    return z.NEVER
  }
  return { document_type: values.document_type, document_type_other: other }
})

export type EvidenceTypeInput = z.input<typeof evidenceTypeSchema>

// Resultado de subir varios archivos de a uno: cuántos se subieron y cuáles fallaron con su motivo.
export function summarizeUploads(results: { name: string; error: string | null }[]) {
  return {
    uploaded: results.filter((result) => !result.error).length,
    failed: results.filter((result): result is { name: string; error: string } => Boolean(result.error)),
  }
}

type UploadSteps = {
  // Deja el archivo listo para subir (las fotos se achican); puede lanzar si no se puede leer.
  prepare: (file: File) => Promise<File>
  upload: (file: File) => Promise<{ error: string | null }>
  onProgress?: (index: number, file: File) => void
}

// Sube los archivos de a uno. Un archivo que falla (tipo, tamaño, foto ilegible, error o excepción al
// subir) no corta el lote: se informa y se sigue con el próximo. `failedFiles` son los que quedan para
// reintentar; los subidos no se vuelven a mandar.
export async function runUploads(files: File[], { prepare, upload, onProgress }: UploadSteps) {
  const results: { name: string; error: string | null }[] = []
  const failedFiles: File[] = []
  const fail = (file: File, error: string) => {
    results.push({ name: file.name, error })
    failedFiles.push(file)
  }

  for (const [index, file] of files.entries()) {
    onProgress?.(index, file)
    if (!isEvidenceContentType(file.type)) {
      fail(file, 'Tiene que ser una foto (JPG, PNG o WebP) o un PDF.')
      continue
    }
    let ready: File
    try {
      ready = await prepare(file)
    } catch {
      fail(file, 'No pudimos leer la foto. Probá con otra o sacá una captura.')
      continue
    }
    if (ready.size > FLEET_EVIDENCE_MAX_BYTES) {
      fail(file, 'Supera los 10 MB.')
      continue
    }
    try {
      const { error } = await upload(ready)
      if (error) fail(file, error)
      else results.push({ name: file.name, error: null })
    } catch {
      fail(file, 'No se pudo subir. Revisá tu conexión e intentá nuevamente.')
    }
  }
  return { results, failedFiles }
}

export type Evidence = {
  id: string
  requestId: string | null
  recordId: string | null
  typeLabel: string
  name: string
  isPdf: boolean
  // Ruta de la app que abre el archivo (/movilidad/archivos/[id]): valida sesión y permiso y recién ahí
  // redirige a un enlace firmado corto. Un enlace compartido no sirve sin Movilidad ni después del borrado.
  url: string
  createdAt: string
  createdById: string
}

// Vida del enlace firmado al que redirige /movilidad/archivos/[id]: alcanza para abrirlo.
export const EVIDENCE_URL_TTL_SECONDS = 60

export function evidenceHref(evidenceId: string) {
  return `/movilidad/archivos/${evidenceId}`
}

type EvidenceRow = {
  id: string; vehicle_request_id: string | null; vehicle_record_id: string | null; document_type_other: string | null
  original_name: string; content_type: string; created_at: string; created_by: string
  type: { name: string } | { name: string }[] | null
}

// Archivos no borrados (RLS) de las solicitudes y registros indicados. Si la consulta
// falla (p. ej. la migración todavía no está aplicada) devuelve [] para no romper la pantalla.
export async function getEvidence(supabase: SupabaseClient, filter: { requestIds?: string[]; recordIds?: string[] }): Promise<Evidence[]> {
  const conditions = [
    filter.requestIds?.length ? `vehicle_request_id.in.(${filter.requestIds.join(',')})` : null,
    filter.recordIds?.length ? `vehicle_record_id.in.(${filter.recordIds.join(',')})` : null,
  ].filter(Boolean)
  if (conditions.length === 0) return []

  const { data, error } = await supabase.from('fleet_evidence')
    .select('id, vehicle_request_id, vehicle_record_id, document_type_other, original_name, content_type, created_at, created_by, type:evidence_document_types(name)')
    .or(conditions.join(','))
    .order('created_at')
  if (error || !data?.length) return []

  const rows = data as EvidenceRow[]
  return rows.map((row) => {
    const type = Array.isArray(row.type) ? row.type[0] : row.type
    return {
      id: row.id,
      requestId: row.vehicle_request_id,
      recordId: row.vehicle_record_id,
      typeLabel: row.document_type_other ?? type?.name ?? 'Documento',
      name: row.original_name,
      isPdf: row.content_type === 'application/pdf',
      url: evidenceHref(row.id),
      createdAt: row.created_at,
      createdById: row.created_by,
    }
  })
}

export type EvidenceDocumentType = { key: string; name: string }

// Tipos activos, en el orden de la lista.
export async function getEvidenceTypes(supabase: SupabaseClient): Promise<EvidenceDocumentType[]> {
  const { data } = await supabase.from('evidence_document_types').select('key, name').eq('active', true).order('sort_order')
  return (data ?? []) as EvidenceDocumentType[]
}
