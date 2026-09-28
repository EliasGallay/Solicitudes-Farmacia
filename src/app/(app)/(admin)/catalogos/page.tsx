import { ProductForm } from '@/components/products/product-form'
import { FormError, FormSuccess } from '@/components/form-feedback'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ListFooter } from '@/components/list-footer'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, createProductType, toggleProduct, toggleProductType, updateProduct, updateProductType } from '@/app/product-actions'
import { getAreas, getProductTypes } from '@/lib/areas'
import { listHref, pageParamSchema, pageRange, pageSizeParam, pageSizeParamSchema } from '@/lib/filters'
import { feedbackMessage } from '@/lib/feedback'
import { requireRole } from '@/lib/session'

export default async function CatalogsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; page?: string; por_pagina?: string }> }) {
  const { supabase } = await requireRole('admin')

  const params = await searchParams
  const page = pageParamSchema.parse(params.page)
  const pageSize = pageSizeParamSchema.parse(params.por_pagina)

  const [{ data: products, count: productCount }, { data: centers }, allAreas, allTypes] = await Promise.all([
    supabase.from('products').select('id, area, name, presentation, product_type, active', { count: 'exact' }).order('name').range(...pageRange(page, pageSize)),
    supabase.from('health_centers').select('id, name, active').order('name'),
    getAreas(true),
    getProductTypes(),
  ])
  const areas = allAreas ?? []
  const types = allTypes ?? []
  // Los productos nuevos y los tipos nuevos solo van a rubros activos; un producto existente puede
  // seguir en un rubro inactivo.
  const activeAreas = areas.filter((area) => area.active)

  return (
    <>
      <PageHeader title="Catálogos" description="Administrá los productos disponibles para las solicitudes." />

      <FormError>{feedbackMessage(params.error)}</FormError>
      <FormSuccess>{feedbackMessage(params.success)}</FormSuccess>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="text-xl font-semibold">Nuevo producto</h2>
        <div className="mt-4"><ProductForm action={createProduct} areas={activeAreas} types={types} submitLabel="Agregar" /></div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h2 className="text-xl font-semibold">Productos</h2><span className="text-sm text-foreground-secondary">{productCount ?? 0} registro(s)</span></div>
        <div className="mt-4 space-y-4">
          {(products ?? []).map((product) => (
            <div key={product.id} className="rounded-lg border border-border p-4">
              <ProductForm action={updateProduct} areas={areas.filter((area) => area.active || area.key === product.area)} types={types} productId={product.id} defaultValues={{ area: product.area, name: product.name, presentation: product.presentation, product_type: product.product_type }} submitLabel="Guardar" />
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
        <h2 className="text-xl font-semibold">Tipos de producto</h2>
        <p className="mt-1 text-sm text-foreground-secondary">Cada rubro tiene sus propios tipos. Un tipo desactivado deja de ofrecerse, pero los productos que ya lo usan lo conservan.</p>
        <form action={createProductType} className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          {activeAreas.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo-rubro">Rubro</Label>
              <Select name="area" required>
                <SelectTrigger id="tipo-rubro" className="sm:w-48"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{activeAreas.map((area) => <SelectItem key={area.key} value={area.key}>{area.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : <input type="hidden" name="area" value={activeAreas[0]?.key ?? ''} />}
          <div className="flex flex-col gap-2 sm:col-start-2">
            <Label htmlFor="tipo-nombre">Nuevo tipo</Label>
            <Input id="tipo-nombre" name="label" required maxLength={60} placeholder="Ej.: Reactivo" />
          </div>
          <Button type="submit">Agregar</Button>
        </form>
        <div className="mt-6 space-y-6">
          {areas.map((area) => {
            const areaTypes = types.filter((type) => type.area === area.key)
            return (
              <div key={area.key}>
                <h3 className="text-base font-semibold">{area.name}{!area.active && <span className="ml-2 text-sm font-normal text-foreground-secondary">(rubro inactivo)</span>}</h3>
                {areaTypes.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                    {areaTypes.map((type) => (
                      <li key={type.key} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                        <form action={updateProductType} className="flex min-w-0 flex-1 items-center gap-3">
                          <input type="hidden" name="area" value={type.area} />
                          <input type="hidden" name="key" value={type.key} />
                          <Input name="label" aria-label={`Nombre del tipo ${type.label}`} defaultValue={type.label} required maxLength={60} className="min-w-0 sm:max-w-xs" />
                          <Button type="submit" variant="secondary" size="sm">Guardar</Button>
                        </form>
                        <div className="flex items-center justify-between gap-3 text-sm sm:justify-end">
                          <span className={type.active ? 'text-success' : 'text-foreground-secondary'}>{type.active ? 'Activo' : 'Inactivo'}</span>
                          <form action={toggleProductType}><input type="hidden" name="area" value={type.area} /><input type="hidden" name="key" value={type.key} /><input type="hidden" name="active" value={String(type.active)} /><ConfirmSubmit message={type.active ? '¿Desactivar este tipo?' : '¿Reactivar este tipo?'}>{type.active ? 'Desactivar' : 'Reactivar'}</ConfirmSubmit></form>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-sm text-foreground-secondary">Todavía no hay tipos en este rubro.</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 className="text-xl font-semibold">Centros de salud</h2>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{(centers ?? []).map((center) => <li key={center.id} className="rounded-md border border-border p-3"><span className="font-medium">{center.name}</span><span className="ml-2 text-foreground-secondary">{center.active ? 'Activo' : 'Inactivo'}</span></li>)}</ul>
      </section>
    </>
  )
}
