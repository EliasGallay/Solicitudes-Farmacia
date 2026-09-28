import { relationOne } from './requests'

// Tipos de producto por rubro (public.product_types). Se leen de la base con getProductTypes (./areas).
export type ProductTypeOption = { area: string; key: string; label: string; active: boolean }

// Relación embebida products → product_types (FK compuesta area + product_type), ej. `type:product_types(label)`.
export type ProductTypeRelation = { label: string } | { label: string }[] | null | undefined

export function productTypeLabel(relation: ProductTypeRelation) {
  return relationOne(relation)?.label ?? '—'
}
