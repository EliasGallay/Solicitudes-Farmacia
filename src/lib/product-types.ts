import { normalizeSearch } from './filters'
import { relationOne } from './requests'

// Tipos de producto por rubro (public.product_types). Se leen de la base con getProductTypes (./areas).
export type ProductTypeOption = { area: string; key: string; label: string; active: boolean }

// Relación embebida products → product_types (FK compuesta area + product_type), ej. `type:product_types(label)`.
export type ProductTypeRelation = { label: string } | { label: string }[] | null | undefined

export function productTypeLabel(relation: ProductTypeRelation) {
  return relationOne(relation)?.label ?? '—'
}

// Clave de un tipo nuevo a partir de su label ("Artículos de limpieza" -> "articulos_de_limpieza"),
// con el formato del check de public.product_types.key. Vacía si el label no tiene letras.
export function productTypeKey(label: string) {
  const key = normalizeSearch(label).replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+/, '')
  return key.slice(0, 50).replace(/_+$/, '')
}
