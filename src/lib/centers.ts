import { cache } from 'react'
import { getSession } from './session'

export type Center = { id: string; name: string; active: boolean }

// Cantidad de colores de centro definidos en globals.css (--color-center-N).
export const CENTER_TONES = 8

// Centros visibles (RLS): todos para el admin. Ordenados por nombre; null ante un error.
export const getCenters = cache(async (): Promise<Center[] | null> => {
  const session = await getSession()
  if (!session) return []
  const { data, error } = await session.supabase.from('health_centers').select('id, name, active').order('name')
  if (error) console.error('Error al cargar centros', error)
  return error ? null : (data ?? []) as Center[]
})

// Color del centro según su posición en la lista completa (activos e inactivos, por nombre): con hasta
// CENTER_TONES centros cada uno tiene un color distinto. Un centro desconocido devuelve el primero.
export function centerTone(centers: Center[], id: string) {
  return Math.max(centers.findIndex((center) => center.id === id), 0) % CENTER_TONES
}
