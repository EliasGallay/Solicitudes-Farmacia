import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // El remito firmado (/entregas/[id]/recibir) se sube por server action: hasta 5 MB por archivo
  // (SIGNED_NOTE_MAX_BYTES en src/lib/signed-notes.ts), con margen para el resto del formulario.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
}
export default nextConfig
