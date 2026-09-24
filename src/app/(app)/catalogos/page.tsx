import { redirect } from 'next/navigation'
import { ProductForm } from '@/components/products/product-form'
import { FormError, FormSuccess } from '@/components/form-feedback'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { createProduct, toggleProduct, updateProduct } from '@/app/product-actions'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CatalogsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }, { data: centers }] = await Promise.all([
    supabase.from('profiles').select('role, must_change_password').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('id, name, presentation, product_type, active').order('name'),
    supabase.from('health_centers').select('id, name, active').order('name'),
  ])
  if (profile?.must_change_password) redirect('/change-password')
  if (profile?.role !== 'admin') redirect('/?error=Solo+un+administrador+puede+gestionar+catálogos')
  const params = await searchParams

  return (
    <>
      <PageHeader title="Catálogos" description="Administrá los productos disponibles para las solicitudes." />

      <FormError>{params.error}</FormError>
      <FormSuccess>{params.success}</FormSuccess>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Nuevo producto</h2>
        <div className="mt-4"><ProductForm action={createProduct} submitLabel="Agregar" /></div>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Productos</h2><span className="text-sm text-muted-foreground">{(products ?? []).length} registro(s)</span></div>
        <div className="mt-4 space-y-4">
          {(products ?? []).map((product) => (
            <div key={product.id} className="rounded-lg border border-border p-4">
              <ProductForm action={updateProduct} productId={product.id} defaultValues={{ name: product.name, presentation: product.presentation, product_type: product.product_type }} submitLabel="Guardar" />
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className={product.active ? 'text-success' : 'text-muted-foreground'}>{product.active ? 'Activo' : 'Inactivo'}</span>
                <form action={toggleProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(product.active)} /><ConfirmSubmit message={product.active ? '¿Desactivar este producto?' : '¿Reactivar este producto?'}>{product.active ? 'Desactivar' : 'Reactivar'}</ConfirmSubmit></form>
              </div>
            </div>
          ))}
          {(products ?? []).length === 0 && <EmptyState>No hay productos cargados.</EmptyState>}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Centros de salud</h2>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-3">{(centers ?? []).map((center) => <li key={center.id} className="rounded-md border border-border p-3"><span className="font-medium">{center.name}</span><span className="ml-2 text-muted-foreground">{center.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul>
      </section>
    </>
  )
}
