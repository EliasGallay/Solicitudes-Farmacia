'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Paperclip } from 'lucide-react'
import { uploadFleetEvidence } from '@/app/fleet-actions'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EVIDENCE_OTHER_MAX, evidenceTypeSchema, FLEET_EVIDENCE_MAX_BYTES, OTHER_DOCUMENT_TYPE, runUploads, summarizeUploads, type EvidenceDocumentType, type EvidenceTarget } from '@/lib/fleet-evidence'
import { compressImage } from '@/lib/image-compression'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

// Adjunta uno o más archivos del mismo tipo de documento a una solicitud o a un registro. Las fotos se
// achican en el navegador y los archivos se suben de a uno: si alguno falla, los demás quedan subidos y
// se informa cuál falló y por qué.
export function EvidenceUploadForm({ target, types }: { target: EvidenceTarget; types: EvidenceDocumentType[] }) {
  const router = useRouter()
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [documentType, setDocumentType] = useState('')
  const [other, setOther] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [inputKey, setInputKey] = useState(0)
  const [error, setError] = useState<string>()
  const [summary, setSummary] = useState<ReturnType<typeof summarizeUploads>>()
  const [progress, setProgress] = useState<string>()

  async function prepare(file: File): Promise<File> {
    if (file.type === 'application/pdf') return file
    return compressImage(file, FLEET_EVIDENCE_MAX_BYTES, `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`)
  }

  function submit() {
    setError(undefined)
    setSummary(undefined)
    const type = evidenceTypeSchema.safeParse({ document_type: documentType, document_type_other: other })
    if (!type.success) return setError(type.error.issues[0]?.message ?? 'Elegí el tipo de documento')
    if (files.length === 0) return setError('Elegí al menos un archivo')

    startTransition(async () => {
      const { results, failedFiles } = await runUploads(files, {
        prepare,
        upload: (file) => {
          const formData = new FormData()
          formData.set('file', file)
          return uploadFleetEvidence(target, { document_type: documentType, document_type_other: other }, formData)
        },
        onProgress: (index, file) => setProgress(`Subiendo ${index + 1} de ${files.length}: ${file.name}`),
      })
      setProgress(undefined)
      setSummary(summarizeUploads(results))
      // Quedan elegidos solo los que fallaron: reintentar no vuelve a subir los que ya están.
      setFiles(failedFiles)
      setInputKey((key) => key + 1)
      if (failedFiles.length === 0) setOther('')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-tipo`}>Tipo de documento</Label>
        <Select value={documentType} onValueChange={setDocumentType} disabled={pending}>
          <SelectTrigger id={`${id}-tipo`}><SelectValue placeholder="Elegí el tipo" /></SelectTrigger>
          <SelectContent>{types.map((type) => <SelectItem key={type.key} value={type.key}>{type.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {documentType === OTHER_DOCUMENT_TYPE && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-otro`}>¿Qué documento es?</Label>
          <Input id={`${id}-otro`} value={other} onChange={(event) => setOther(event.target.value)} maxLength={EVIDENCE_OTHER_MAX} placeholder="Ej.: Constancia de seguro" disabled={pending} />
        </div>
      )}
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor={`${id}-archivos`}>Archivos</Label>
        <Input key={inputKey} id={`${id}-archivos`} type="file" multiple accept={ACCEPT} disabled={pending} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        {files.length > 0 && summary && summary.failed.length > 0 && (
          <p className="text-xs text-foreground-secondary">Para reintentar quedan elegidos {files.length === 1 ? 'el archivo que falló' : `los ${files.length} archivos que fallaron`}; elegí otros para reemplazarlos.</p>
        )}
        <p className="text-xs text-foreground-secondary">Fotos (JPG, PNG o WebP) o PDF, hasta 10 MB cada uno. Las fotos se achican antes de subirlas.</p>
      </div>
      {error && <Alert variant="destructive" className="md:col-span-2">{error}</Alert>}
      {summary && summary.uploaded > 0 && <Alert variant="success" className="md:col-span-2">{summary.uploaded === 1 ? 'Se adjuntó 1 archivo.' : `Se adjuntaron ${summary.uploaded} archivos.`}</Alert>}
      {summary && summary.failed.length > 0 && (
        <Alert variant="destructive" className="md:col-span-2">
          <p className="font-semibold">{summary.failed.length === 1 ? 'No se pudo subir 1 archivo:' : `No se pudieron subir ${summary.failed.length} archivos:`}</p>
          <ul className="mt-1 list-disc pl-5">{summary.failed.map((item, index) => <li key={`${index}-${item.name}`}><span className="font-medium break-all">{item.name}</span>: {item.error}</li>)}</ul>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="button" onClick={submit} disabled={pending}>{pending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Paperclip aria-hidden />}{pending ? 'Subiendo...' : 'Adjuntar'}</Button>
        {progress && <span className="text-sm text-foreground-secondary" aria-live="polite">{progress}</span>}
      </div>
    </div>
  )
}
