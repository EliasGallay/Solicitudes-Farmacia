import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv, getSupabaseSecretKey } from './env'

// Cliente con la clave secreta: saltea RLS. Uso exclusivo de server actions ya protegidas con
// requireRole('admin') y solo para la API de administración de Supabase Auth (cuentas, email,
// contraseña, bloqueo). Los datos de la app siguen pasando por el cliente de la sesión.
export function createSupabaseAdminClient() {
  return createClient(getSupabaseEnv().NEXT_PUBLIC_SUPABASE_URL, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
