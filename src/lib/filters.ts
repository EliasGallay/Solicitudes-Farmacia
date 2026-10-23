import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Texto de búsqueda recibido por URL: recortado, acotado y opcional.
export const searchParamSchema = z.string().trim().min(1).max(100).optional().catch(undefined)

// Claves de rubro y de tipo de producto: mismo formato que los checks de public.areas y public.product_types.
export const keySchema = z.string().regex(/^[a-z][a-z0-9_]*$/).max(50)
export const keyParamSchema = keySchema.optional().catch(undefined)

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

// Vocabulario de public.search_variants (supabase/migrations/202610220001_fuzzy_search.sql).
export type SearchScope = 'productos' | 'tipos' | 'usuarios'

// Largo mínimo de una palabra para buscarle parecidas (mismo valor que search_variants).
export const FUZZY_MIN_LENGTH = 4

// Palabras de búsqueda con sus parecidas del vocabulario, tolerando errores de tipeo: cada grupo es
// [lo escrito, ...parecidas] y basta con que aparezca una del grupo. Si la consulta falla se busca
// solo lo escrito, como antes.
export async function searchTerms(supabase: Pick<SupabaseClient, 'rpc'>, scope: SearchScope, term: string): Promise<string[][]> {
  const tokens = searchTokens(term)
  if (!tokens.some((token) => token.length >= FUZZY_MIN_LENGTH)) return tokens.map((token) => [token])
  const { data, error } = await supabase.rpc('search_variants', { scope, tokens })
  const variants = new Map(error ? [] : ((data ?? []) as { token: string; variants: string[] }[]).map((row) => [row.token, row.variants]))
  return tokens.map((token) => [token, ...(variants.get(token) ?? [])])
}

// Valor entre comillas para un filtro PostgREST `or` (las palabras pueden traer comas o paréntesis).
function quoteFilterValue(value: string) {
  return `"${value.replace(/["\\]/g, (char) => `\\${char}`)}"`
}

// Filtro `or` de PostgREST: `column` contiene alguna de las palabras del grupo.
export function containsAnyFilter(column: string, words: string[]) {
  return words.map((word) => `${column}.ilike.${quoteFilterValue(likeContains(word))}`).join(',')
}

// Aplica la búsqueda a una consulta: cada grupo debe coincidir (con lo escrito o una parecida).
export function applySearch<Query extends { or: (filters: string) => Query }>(query: Query, column: string, terms: string[][]) {
  return terms.reduce((current, words) => current.or(containsAnyFilter(column, words)), query)
}

// Lo mismo en memoria, para listas chicas que se filtran en el servidor sin consultar (tipos).
export function matchesSearch(text: string, terms: string[][]) {
  const normalized = normalizeSearch(text)
  return terms.every((words) => words.some((word) => normalized.includes(word)))
}
