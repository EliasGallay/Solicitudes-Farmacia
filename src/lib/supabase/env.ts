import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export function getSupabaseEnv() {
  return schema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
}

// Clave secreta de Supabase (sb_secret_... o service_role). Solo existe en el servidor: sin el
// prefijo NEXT_PUBLIC_, Next.js nunca la incluye en el bundle del navegador.
export function getSupabaseSecretKey() {
  return z.string().min(1, 'Falta SUPABASE_SECRET_KEY').parse(process.env.SUPABASE_SECRET_KEY)
}
