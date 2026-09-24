import { z } from 'zod'

// Texto de búsqueda recibido por URL: recortado, acotado y opcional.
export const searchParamSchema = z.string().trim().min(1).max(100).optional().catch(undefined)

export const PAGE_SIZE = 10
export const pageParamSchema = z.coerce.number().int().min(1).catch(1)

// URL de un listado con sus filtros activos y la página indicada (la página 1 se omite).
export function listHref(pathname: string, filters: Record<string, string | undefined>, page = 1) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  if (page > 1) params.set('page', String(page))
  return params.size ? `${pathname}?${params}` : pathname
}

// Valor `ilike` con los comodines de LIKE escapados y citado para la sintaxis de filtros de PostgREST.
export function ilikePattern(term: string) {
  const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  return `"${pattern.replace(/["\\]/g, (char) => `\\${char}`)}"`
}

// Filtro `or` de PostgREST que busca `term` en cualquiera de las columnas indicadas.
export function ilikeAny(columns: string[], term: string) {
  const pattern = ilikePattern(term)
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',')
}
