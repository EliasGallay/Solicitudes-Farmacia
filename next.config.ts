import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Archivos por server action: remito firmado (/entregas/[id]/recibir, hasta 5 MB, SIGNED_NOTE_MAX_BYTES)
  // y evidencias de Movilidad (de a uno, hasta 10 MB, FLEET_EVIDENCE_MAX_BYTES), con margen para el resto.
  experimental: { serverActions: { bodySizeLimit: '11mb' } },
}
export default nextConfig
