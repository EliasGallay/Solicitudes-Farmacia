import { z } from 'zod'

// Tipos del rubro 'pharmacy' en public.product_types (supabase/migrations/202609280001_areas.sql).
export const productTypes = ['medication', 'disposable', 'equipment'] as const
export type ProductType = (typeof productTypes)[number]

export const productTypeLabels: Record<ProductType, string> = {
  medication: 'Medicamento',
  disposable: 'Descartable',
  equipment: 'Equipamiento',
}

export const productTypeSchema = z.enum(productTypes)
export const productTypeParamSchema = productTypeSchema.optional().catch(undefined)
