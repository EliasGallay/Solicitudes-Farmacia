import { cache } from 'react'
import type { ProductTypeOption } from './product-types'
import { getSession, type AreaKey } from './session'

export type Area = { key: AreaKey; name: string; active: boolean }

// Nombre para mostrar; un rubro inactivo (fuera de getAreas) se muestra por su clave.
export function areaName(areas: Area[], key: AreaKey) {
  return areas.find((area) => area.key === key)?.name ?? key
}

// Rubro elegido por URL (?rubro=), solo si es uno de los visibles.
export function selectedArea(areas: Area[], key: AreaKey | undefined) {
  return key ? areas.find((area) => area.key === key) : undefined
}

// Ambas consultas devuelven null ante un error, para que cada página muestre su estado de error.

// Rubros visibles para el usuario (RLS): todos para el admin, los asignados para el solicitante.
// Por defecto solo los activos; `includeInactive` es para la gestión del admin.
export const getAreas = cache(async (includeInactive = false): Promise<Area[] | null> => {
  const session = await getSession()
  if (!session) return []
  let query = session.supabase.from('areas').select('key, name, active')
  if (!includeInactive) query = query.eq('active', true)
  const { data, error } = await query.order('name')
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
