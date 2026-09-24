import { z } from 'zod'

// Valores del enum public.product_type (supabase/migrations/202609240005_product_type.sql).
export const productTypes = ['medication', 'disposable', 'equipment'] as const
export type ProductType = (typeof productTypes)[number]

export const productTypeLabels: Record<ProductType, string> = {
  medication: 'Medicamento',
  disposable: 'Descartable',
  equipment: 'Equipamiento',
}

export const productTypeSchema = z.enum(productTypes)
export const productTypeParamSchema = productTypeSchema.optional().catch(undefined)
