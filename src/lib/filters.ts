import { z } from 'zod'

// Texto de búsqueda recibido por URL: recortado, acotado y opcional.
export const searchParamSchema = z.string().trim().min(1).max(100).optional().catch(undefined)

// Paginación estándar: tamaño elegible desde el pie de cada listado (?por_pagina=).
export const PAGE_SIZES = [5, 10, 15, 25, 50] as const
export const DEFAULT_PAGE_SIZE = 10
export const pageParamSchema = z.coerce.number().int().min(1).catch(1)
export const pageSizeParamSchema = z.coerce.number().int().refine((value) => (PAGE_SIZES as readonly number[]).includes(value)).catch(DEFAULT_PAGE_SIZE)

// Valor de ?por_pagina= para la URL: se omite el tamaño por defecto.
export function pageSizeParam(size: number) {
  return size === DEFAULT_PAGE_SIZE ? undefined : String(size)
}

// Rango [desde, hasta] (inclusive) para `.range()` de Supabase.
export function pageRange(page: number, size: number): [number, number] {
  const from = (page - 1) * size
  return [from, from + size - 1]
}

const MAX_SEARCH_TOKENS = 6

// URL de un listado con sus filtros activos y la página indicada (la página 1 se omite).
export function listHref(pathname: string, filters: Record<string, string | undefined>, page = 1) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  if (page > 1) params.set('page', String(page))
  return params.size ? `${pathname}?${params}` : pathname
}

// Normaliza igual que public.normalize_search en la base: minúsculas y sin acentos.
export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Palabras de búsqueda normalizadas; cada una se filtra por separado y todas deben coincidir.
export function searchTokens(term: string) {
  return [...new Set(normalizeSearch(term).split(/\s+/).filter(Boolean))].slice(0, MAX_SEARCH_TOKENS)
}

// Patrón `ilike` "contiene" con los comodines de LIKE escapados.
export function likeContains(token: string) {
  return `%${token.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}
