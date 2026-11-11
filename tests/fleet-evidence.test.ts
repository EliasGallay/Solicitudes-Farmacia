import { describe, expect, it } from 'vitest'
import { evidenceName, evidencePath, evidenceTypeSchema, getEvidence, isEvidenceContentType, runUploads, summarizeUploads } from '../src/lib/fleet-evidence'

describe('ruta del archivo', () => {
  it('guarda en la carpeta de la solicitud', () => expect(evidencePath({ kind: 'request', id: 'r1' }, 'application/pdf', 'abc')).toBe('solicitudes/r1/abc.pdf'))
  it('guarda en la carpeta del registro', () => expect(evidencePath({ kind: 'record', id: 'x1' }, 'image/jpeg', 'abc')).toBe('registros/x1/abc.jpg'))
  it('genera un nombre distinto por archivo', () => expect(evidencePath({ kind: 'request', id: 'r1' }, 'image/png')).not.toBe(evidencePath({ kind: 'request', id: 'r1' }, 'image/png')))
})

describe('tipo de archivo', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('acepta %s', (type) => expect(isEvidenceContentType(type)).toBe(true))
  it.each(['image/heic', 'text/html', 'toString', ''])('rechaza %s', (type) => expect(isEvidenceContentType(type)).toBe(false))
})

describe('tipo de documento', () => {
  it('«Otro» exige texto', () => expect(evidenceTypeSchema.safeParse({ document_type: 'other', document_type_other: ' ' }).success).toBe(false))
  it('«Otro» acepta hasta 60 caracteres', () => expect(evidenceTypeSchema.safeParse({ document_type: 'other', document_type_other: 'x'.repeat(61) }).success).toBe(false))
  it('«Otro» guarda el texto sin espacios en los extremos', () => expect(evidenceTypeSchema.parse({ document_type: 'other', document_type_other: '  Foto del tablero ' }).document_type_other).toBe('Foto del tablero'))
  it('otros tipos descartan el texto', () => expect(evidenceTypeSchema.parse({ document_type: 'budget', document_type_other: 'x' }).document_type_other).toBeNull())
  it('exige elegir un tipo', () => expect(evidenceTypeSchema.safeParse({ document_type: '', document_type_other: '' }).success).toBe(false))
})

describe('nombre y resumen de la subida', () => {
  it('recorta el nombre a 200', () => expect(evidenceName('a'.repeat(250) + '.pdf')).toHaveLength(200))
  it('nombre vacío', () => expect(evidenceName('  ')).toBe('archivo'))
  it('resume una subida con fallas', () => expect(summarizeUploads([{ name: 'a.pdf', error: null }, { name: 'b.heic', error: 'Tipo no permitido' }])).toEqual({ uploaded: 1, failed: [{ name: 'b.heic', error: 'Tipo no permitido' }] }))
})

describe('subida de varios archivos', () => {
  const pdf = (name: string, size = 10) => new File([new Uint8Array(size)], name, { type: 'application/pdf' })
  const heic = new File([new Uint8Array(10)], 'foto.heic', { type: 'image/heic' })
  const same = async (file: File) => file
  const ok = async () => ({ error: null })

  it('sube los válidos aunque haya uno inválido antes', async () => {
    const uploaded: string[] = []
    const result = await runUploads([heic, pdf('a.pdf')], { prepare: same, upload: async (file) => { uploaded.push(file.name); return { error: null } } })
    expect(uploaded).toEqual(['a.pdf'])
    expect(result.failedFiles).toEqual([heic])
    expect(summarizeUploads(result.results).uploaded).toBe(1)
  })
  it('una excepción al subir no corta el lote', async () => {
    const b = pdf('b.pdf')
    const result = await runUploads([b, pdf('c.pdf')], { prepare: same, upload: async (file) => { if (file.name === 'b.pdf') throw new Error('red'); return { error: null } } })
    expect(result.failedFiles).toEqual([b])
    expect(result.results.map((item) => item.error === null)).toEqual([false, true])
  })
  it('una foto que no se puede leer se informa y sigue', async () => {
    const photo = new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' })
    const result = await runUploads([photo, pdf('d.pdf')], { prepare: async (file) => { if (file.type !== 'application/pdf') throw new Error('decode'); return file }, upload: ok })
    expect(result.failedFiles).toEqual([photo])
  })
  it('rechaza lo que supera 10 MB sin subirlo', async () => {
    const big = pdf('grande.pdf', 10 * 1024 * 1024 + 1)
    let calls = 0
    const result = await runUploads([big], { prepare: same, upload: async () => { calls += 1; return { error: null } } })
    expect(calls).toBe(0)
    expect(result.failedFiles).toEqual([big])
  })
  it('los subidos no quedan para reintentar', async () => {
    const result = await runUploads([pdf('a.pdf'), pdf('b.pdf')], { prepare: same, upload: ok })
    expect(result.failedFiles).toEqual([])
  })
})

describe('enlace de los archivos', () => {
  it('apunta a la ruta con permisos de la app, no a un enlace firmado', async () => {
    let signed = false
    const row = { id: 'e1', vehicle_request_id: 'r1', vehicle_record_id: null, document_type_other: null, storage_path: 'solicitudes/r1/a.pdf', original_name: 'a.pdf', content_type: 'application/pdf', created_at: '2026-10-29T12:00:00Z', created_by: 'u1', type: { name: 'Factura' } }
    const query = { select: () => query, or: () => query, order: async () => ({ data: [row], error: null }) }
    const supabase = { from: () => query, storage: { from: () => ({ createSignedUrls: async () => { signed = true; return { data: [] } } }) } }
    const [item] = await getEvidence(supabase as never, { requestIds: ['r1'] })
    expect(item.url).toBe('/movilidad/archivos/e1')
    expect(signed).toBe(false)
  })
})
