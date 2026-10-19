import { timingSafeEqual } from 'node:crypto'

// Vercel Cron llama a las rutas de vercel.json con `Authorization: Bearer <CRON_SECRET>` cuando la
// variable está definida en el proyecto. Sin secreto configurado no se autoriza nada.
export function isAuthorizedCron(authorization: string | null, secret: string | undefined) {
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization)
  return expected.length === received.length && timingSafeEqual(expected, received)
}
