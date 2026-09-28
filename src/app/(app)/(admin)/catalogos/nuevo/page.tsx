import { createProduct } from '@/app/product-actions'
import { BackButton } from '@/components/back-button'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { ProductForm } from '@/components/products/product-form'
import { Card, CardContent } from '@/components/ui/card'
import { getAreas, getProductTypes } from '@/lib/areas'
import { feedbackMessage } from '@/lib/feedback'
import { requireRole } from '@/lib/session'

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole('admin')
  const [{ error }, areas, types] = await Promise.all([searchParams, getAreas(), getProductTypes()])

  return (
    <>
      <BackButton fallback="/catalogos" />
      <PageHeader title="Nuevo producto" description="El producto queda disponible para solicitar en su rubro." />
      {error && <div className="-mt-4 mb-6"><FormError>{feedbackMessage(error)}</FormError></div>}
      <Card>
        {/* Los productos nuevos solo van a rubros activos (getAreas sin inactivos). */}
        <CardContent className="pt-6"><ProductForm action={createProduct} areas={areas ?? []} types={types ?? []} submitLabel="Agregar" /></CardContent>
      </Card>
    </>
  )
}
