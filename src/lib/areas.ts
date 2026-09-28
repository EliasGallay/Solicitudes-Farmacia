import { cache } from 'react'
import type { ProductTypeOption } from './product-types'
import { getSession, type AreaKey } from './session'

export type Area = { key: AreaKey; name: string }

// Ambas consultas devuelven null ante un error, para que cada página muestre su estado de error.

// Rubros activos visibles para el usuario (RLS): todos para el admin, los asignados para el solicitante.
export const getAreas = cache(async (): Promise<Area[] | null> => {
  const session = await getSession()
  if (!session) return []
  const { data, error } = await session.supabase.from('areas').select('key, name').eq('active', true).order('name')
  if (error) console.error('Error al cargar rubros', error)
  return error ? null : (data ?? []) as Area[]
})

// Tipos de producto de los rubros visibles, incluidos los inactivos (el admin los gestiona y los
// productos existentes pueden conservarlos). Los selectores de alta muestran solo los activos.
export const getProductTypes = cache(async (): Promise<ProductTypeOption[] | null> => {
  const session = await getSession()
  if (!session) return []
  const { data, error } = await session.supabase.from('product_types').select('area, key, label, active').order('label')
  if (error) console.error('Error al cargar tipos de producto', error)
  return error ? null : (data ?? []) as ProductTypeOption[]
})
