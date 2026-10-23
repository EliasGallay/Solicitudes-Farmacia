'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, FileText, LoaderCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isSignedNoteType, SIGNED_NOTE_MAX_BYTES } from '@/lib/signed-notes'

// Lado mayor y calidad de la foto comprimida: alcanza para leer el remito y la firma, y queda muy por
// debajo del límite de 5 MB (una foto de celular suele pesar 3–8 MB).
const MAX_SIDE = 2000
const QUALITIES = [0.82, 0.65, 0.5]

// Redimensiona la foto y la pasa a JPEG en el navegador. Lanza si el navegador no puede leerla (p. ej.
// HEIC fuera de Safari).
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  // Fondo blanco: un PNG con transparencia no queda negro al pasarlo a JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let blob: Blob | null = null
  for (const quality of QUALITIES) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= SIGNED_NOTE_MAX_BYTES) break
  }
  if (!blob) throw new Error('toBlob')
  return new File([blob], 'remito-firmado.jpg', { type: 'image/jpeg' })
}

// Foto (o PDF) del remito firmado. Las fotos se comprimen al elegirlas; `onChange` recibe el archivo
// listo para subir, o null si se quitó.
export function SignedNoteInput({ value, onChange, disabled }: { value: File | null; onChange: (file: File | null) => void; disabled?: boolean }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!value || value.type === 'application/pdf') {
      setPreview(undefined)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  async function select(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setError(undefined)
    if (file.type === 'application/pdf') {
      if (file.size > SIGNED_NOTE_MAX_BYTES) return setError('El PDF supera los 5 MB.')
      return onChange(file)
    }
    if (!file.type.startsWith('image/')) return setError('Elegí una foto o un PDF.')
    setProcessing(true)
    try {
      onChange(await compressImage(file))
    } catch {
      // Si no se puede comprimir, se sube tal cual cuando el formato y el tamaño lo permiten.
      if (isSignedNoteType(file.type) && file.size <= SIGNED_NOTE_MAX_BYTES) onChange(file)
      else setError('No pudimos leer la foto. Probá sacarla de nuevo en JPG o subí un PDF.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input ref={inputRef} id={inputId} type="file" accept="image/*,application/pdf" className="peer sr-only" disabled={disabled || processing} onChange={(event) => select(event.target.files?.[0])} />
      {value
        ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-3">
            {preview
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image.
              ? <img src={preview} alt="Vista previa del remito firmado" className="h-28 w-auto max-w-40 shrink-0 rounded-md border border-border bg-surface object-contain" />
              : <FileText className="size-10 shrink-0 text-primary-600" aria-hidden />}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold break-words">{value.type === 'application/pdf' ? value.name : 'Foto del remito firmado'}</p>
              <p className="text-xs text-foreground-secondary">{(value.size / 1024 / 1024).toFixed(1)} MB</p>
              <label htmlFor={inputId} className="mt-2 inline-block cursor-pointer text-sm font-medium text-primary-600 hover:underline">Cambiar</label>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled} aria-label="Quitar el archivo"><X /></Button>
          </div>
        )
        : (
          <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm hover:border-primary-500 hover:bg-primary-50 peer-focus-visible:border-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-100">
            {processing ? <LoaderCircle className="size-8 text-primary-600 motion-safe:animate-spin" aria-hidden /> : <Camera className="size-8 text-primary-600" aria-hidden />}
            <span className="font-semibold">{processing ? 'Preparando la foto...' : 'Sacar o elegir una foto del remito firmado'}</span>
            <span className="text-xs text-foreground-secondary">JPG, PNG, WebP o PDF. Las fotos se achican antes de subirlas.</span>
          </label>
        )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
