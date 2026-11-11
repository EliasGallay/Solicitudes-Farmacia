import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withFeedback } from '@/lib/feedback'
import { EVIDENCE_URL_TTL_SECONDS, FLEET_EVIDENCE_BUCKET } from '@/lib/fleet-evidence'
import { requireFleetAccess } from '@/lib/session'

// Abre un archivo de evidencia: exige Movilidad (o admin), lo lee con RLS (un archivo borrado no
// aparece) y redirige a un enlace firmado de pocos segundos. Así un enlace compartido no sirve a quien
// no tiene el rubro ni después de borrar el archivo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireFleetAccess()
  const id = z.string().uuid().safeParse((await params).id)
  const notFound = NextResponse.redirect(new URL(withFeedback('/movilidad', 'error', 'archivo-invalido'), request.url))
  if (!id.success) return notFound

  const { data } = await supabase.from('fleet_evidence').select('storage_path').eq('id', id.data).maybeSingle()
  if (!data) return notFound
  const { data: signed } = await supabase.storage.from(FLEET_EVIDENCE_BUCKET).createSignedUrl(data.storage_path as string, EVIDENCE_URL_TTL_SECONDS)
  if (!signed?.signedUrl) return notFound

  const response = NextResponse.redirect(signed.signedUrl)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
