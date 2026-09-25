import { redirect } from 'next/navigation'
import { ProductForm } from '@/components/products/product-form'
import { FormError, FormSuccess } from '@/components/form-feedback'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ListFooter } from '@/components/list-footer'
import { PageHeader } from '@/components/page-header'
import { createProduct, toggleProduct, updateProduct } from '@/app/product-actions'
import { listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema } from '@/lib/filters'
import { feedbackMessage, withFeedback } from '@/lib/feedback'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CatalogsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; page?: string; por_pagina?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const page = pageParamSchema.parse(params.page)
  const pageSize = pageSizeParamSchema.parse(params.por_pagina)

  const [{ data: profile }, { data: products, count: productCount }, { data: centers }] = await Promise.all([
    supabase.from('profiles').select('role, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, presentation, product_type, active', { count: 'exact' }).order('name').range(...pageRange(page, pageSize)),
    supabase.from('health_centers').select('id, name, active').order('name'),
  ])
  if (profile?.must_change_password) redirect('/change-password')
  if (profile?.role !== 'admin') redirect(withFeedback('/', 'error', 'solo-admin'))

  return (
    <>
      <PageHeader title="Catálogos" description="Administrá los productos disponibles para las solicitudes." />

      <FormError>{feedbackMessage(params.error)}</FormError>
      <FormSuccess>{feedbackMessage(params.success)}</FormSuccess>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="text-xl font-semibold">Nuevo producto</h2>
        <div className="mt-4"><ProductForm action={createProduct} submitLabel="Agregar" /></div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h2 className="text-xl font-semibold">Productos</h2><span className="text-sm text-foreground-secondary">{productCount ?? 0} registro(s)</span></div>
        <div className="mt-4 space-y-4">
          {(products ?? []).map((product) => (
            <div key={product.id} className="rounded-lg border border-border p-4">
              <ProductForm action={updateProduct} productId={product.id} defaultValues={{ name: product.name, presentation: product.presentation, product_type: product.product_type }} submitLabel="Guardar" />
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className={product.active ? 'text-success' : 'text-foreground-secondary'}>{product.active ? 'Activo' : 'Inactivo'}</span>
                <form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(product.active)} /><ConfirmSubmit message={product.active ? '¿Desactivar este producto?' : '¿Reactivar este producto?'}>{product.active ? 'Desactivar' : 'Reactivar'}</ConfirmSubmit></form>
              </div>
            </div>
          ))}
          {(products ?? []).length === 0 && <EmptyState>No hay productos cargados.</EmptyState>}
          {(products ?? []).length > 0 && (
            <div className="border-t border-border pt-3">
              <ListFooter page={page} pageSize={pageSize} shown={(products ?? []).length} total={productCount ?? 0} noun="productos" hrefFor={(value) => listHref('/catalogos', { por_pagina: pageSizeParam(pageSize) }, value)} />
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="text-xl font-semibold">Centros de salud</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{(centers ?? []).map((center) => <li key={center.id} className="rounded-md border border-border p-3"><span className="font-medium">{center.name}</span><span className="ml-2 text-foreground-secondary">{center.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul>
      </section>
    </>
  )
}
