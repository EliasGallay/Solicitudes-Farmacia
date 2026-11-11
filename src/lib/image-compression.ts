// Compresión de fotos en el navegador antes de subirlas (remitos firmados y archivos de Movilidad): una
// foto de celular suele pesar 3–8 MB.

// Lado mayor y calidades que se prueban en orden hasta entrar en `maxBytes`: alcanza para leer un
// documento y una firma.
const MAX_SIDE = 2000
const QUALITIES = [0.82, 0.65, 0.5]

// Redimensiona la foto y la pasa a JPEG con el nombre `name`. Lanza si el navegador no puede leerla
// (p. ej. HEIC fuera de Safari).
export async function compressImage(file: File, maxBytes: number, name: string): Promise<File> {
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
    if (blob && blob.size <= maxBytes) break
  }
  if (!blob) throw new Error('toBlob')
  return new File([blob], name, { type: 'image/jpeg' })
}
