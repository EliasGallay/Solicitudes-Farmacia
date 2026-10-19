import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Actividad diaria para que Supabase no pause el proyecto por inactividad. La llama Vercel Cron
// (vercel.json) todos los días cerca de las 00:05 de Argentina. Ejecuta public.keepalive_ping
// (supabase/migrations/202610190002_keepalive.sql): alta, lectura, modificación y baja solo sobre
// public.keepalive_pings, sin tocar datos de la aplicación.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'no-autorizado' }, { status: 401 })
  }

  // La función solo se puede ejecutar con la clave secreta (rol service_role).
  const { data, error } = await createSupabaseAdminClient().rpc('keepalive_ping', { ping_source: 'vercel-cron' })
  if (error) {
    console.error('Error en keepalive_ping', error)
    return NextResponse.json({ error: 'keepalive-error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, result: data }, { headers: { 'Cache-Control': 'no-store' } })
}
