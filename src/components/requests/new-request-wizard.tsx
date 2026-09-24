'use client'

import { useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, Minus, PackageSearch, Plus, Search, Send, Trash2 } from 'lucide-react'
import { submitRequest } from '@/app/request-actions'
import { EmptyState } from '@/components/empty-state'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSearchFilter, useUrlFilters } from '@/hooks/use-url-filters'
import { productTypeLabels, productTypes, type ProductType } from '@/lib/product-types'
import { OBSERVATIONS_MAX_LENGTH } from '@/lib/requests'
import { cn } from '@/lib/utils'
import { RequestStepper } from './request-stepper'

type Product = { id: string; name: string; presentation: string; product_type: ProductType }

type Center = { id: string; name: string }

const ALL_TYPES = 'todos'

function parseQuantity(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null
}

// `products` llega ya filtrado por el servidor según `buscar` y `tipo`; la selección se conserva entre búsquedas.
// `centers` solo se recibe para el admin, que debe elegir el centro de la solicitud.
export function NewRequestWizard({ products, total, buscar, tipo, centers }: { products: Product[]; total: number; buscar?: string; tipo?: ProductType; centers?: Center[] }) {
  const [step, setStep] = useState<1 | 2>(1)
  const search = useSearchFilter('buscar', buscar)
  const typeFilter = useUrlFilters()
  const filtering = search.pending || typeFilter.pending
  // Cantidades como texto para permitir edición libre; solo se validan al avanzar.
  const [selection, setSelection] = useState<Record<string, { product: Product; quantity: string }>>({})
  const [observations, setObservations] = useState('')
  const [centerId, setCenterId] = useState<string>()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  const selected = Object.values(selection)
  const allValid = selected.length > 0 && selected.every((entry) => parseQuantity(entry.quantity) !== null)
  const canSubmit = allValid && (!centers || Boolean(centerId))

  function setQuantity(product: Product, quantity: string) {
    setSelection((current) => ({ ...current, [product.id]: { product, quantity } }))
  }

  function changeBy(product: Product, delta: number) {
    const next = (parseQuantity(selection[product.id]?.quantity ?? '') ?? 0) + delta
    if (next <= 0) remove(product.id)
    else setQuantity(product, String(next))
  }

  function remove(id: string) {
    setSelection((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
  }

  function submit() {
    setError(undefined)
    const items = selected.map((entry) => ({ product_id: entry.product.id, quantity: parseQuantity(entry.quantity) ?? 0 }))
    startTransition(async () => {
      const result = await submitRequest(items, observations.trim() || undefined, centerId)
      if (result?.error) setError(result.error)
    })
  }

  if (step === 2) {
    return (
      <>
        <RequestStepper current={2} />
        <Card>
          <CardHeader>
            <CardTitle>Revisar solicitud</CardTitle>
            <CardDescription>Verificá los productos y las cantidades antes de enviar la solicitud.</CardDescription>
          </CardHeader>
          <CardContent>
            {centers && (
              <div className="mb-6 flex max-w-md flex-col gap-2">
                <Label htmlFor="centro">Centro de salud</Label>
                <Select value={centerId} onValueChange={setCenterId} disabled={pending}>
                  <SelectTrigger id="centro"><SelectValue placeholder="Seleccionar centro" /></SelectTrigger>
                  <SelectContent>{centers.map((center) => <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {selected.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Presentación</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.map(({ product, quantity }) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-semibold">{product.name}</TableCell>
                      <TableCell>{productTypeLabels[product.product_type]}</TableCell>
                      <TableCell className="text-foreground-secondary">{product.presentation}</TableCell>
                      <TableCell className="text-right tabular-nums">{quantity}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-muted" aria-label={`Quitar ${product.name}`} disabled={pending} onClick={() => remove(product.id)}><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyState icon={PackageSearch} title="No hay productos seleccionados">Volvé al paso anterior para agregar productos.</EmptyState>}
            <div className="mt-6 flex flex-col gap-2">
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea id="observaciones" rows={3} maxLength={OBSERVATIONS_MAX_LENGTH} placeholder="Agregá alguna nota o comentario para esta solicitud..." aria-describedby="observaciones-ayuda" disabled={pending} value={observations} onChange={(event) => setObservations(event.target.value)} />
              <p id="observaciones-ayuda" className="text-right text-xs text-foreground-muted">{observations.length}/{OBSERVATIONS_MAX_LENGTH}</p>
            </div>
            {error && <Alert variant="destructive" className="mt-4">{error}</Alert>}
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
            <Button variant="secondary" disabled={pending} onClick={() => setStep(1)}><ArrowLeft />Volver</Button>
            <Button disabled={pending || !canSubmit} onClick={submit}>{pending ? 'Enviando...' : 'Enviar solicitud'}<Send /></Button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <RequestStepper current={1} />
      <Card>
        <CardHeader>
          <CardTitle>Buscar y agregar productos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
              <Input type="search" aria-label="Buscar producto por nombre" placeholder="Buscar producto por nombre..." className="pl-9" value={search.value} onChange={(event) => search.setValue(event.target.value)} />
            </div>
            <Select value={tipo ?? ALL_TYPES} onValueChange={(value) => typeFilter.setFilters({ tipo: value === ALL_TYPES ? undefined : value })}>
              <SelectTrigger aria-label="Filtrar por tipo" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>Todos los tipos</SelectItem>
                {productTypes.map((type) => <SelectItem key={type} value={type}>{productTypeLabels[type]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {products.length > 0 ? (
            <Table aria-busy={filtering} className={cn('transition-opacity', filtering && 'opacity-60')}>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead className="w-48 text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const value = selection[product.id]?.quantity
                  const isSelected = value !== undefined
                  const invalid = isSelected && parseQuantity(value) === null
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-semibold">{product.name}</TableCell>
                      <TableCell>{productTypeLabels[product.product_type]}</TableCell>
                      <TableCell className="text-foreground-secondary">{product.presentation}</TableCell>
                      <TableCell className="text-right">
                        {isSelected ? (
                          <div className="inline-flex items-center gap-1">
                            <Button variant="secondary" size="icon-sm" aria-label={`Restar una unidad de ${product.name}`} onClick={() => changeBy(product, -1)}><Minus /></Button>
                            <Input type="number" inputMode="numeric" min={1} step={1} aria-label={`Cantidad de ${product.name}`} aria-invalid={invalid || undefined} className="h-9 w-20 text-center tabular-nums" value={value} onChange={(event) => setQuantity(product, event.target.value)} />
                            <Button variant="secondary" size="icon-sm" aria-label={`Sumar una unidad de ${product.name}`} onClick={() => changeBy(product, 1)}><Plus /></Button>
                          </div>
                        ) : <Button variant="secondary" size="sm" className="w-36" onClick={() => setQuantity(product, '1')}>Agregar</Button>}
                        {invalid && <p className="mt-1 text-xs text-danger">Ingresá una cantidad entera mayor a 0.</p>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : total > 0
            ? <EmptyState icon={PackageSearch} title="No encontramos productos">Probá modificando los filtros aplicados.</EmptyState>
            : <EmptyState icon={PackageSearch} title="No hay productos disponibles">Todavía no hay productos activos para solicitar.</EmptyState>}
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
          <p className="text-sm text-foreground-secondary">Mostrando {products.length} de {total} productos</p>
          <div className="flex items-center gap-4">
            <p className="text-sm font-semibold text-primary-600" aria-live="polite">{selected.length} {selected.length === 1 ? 'producto agregado' : 'productos agregados'}</p>
            <Button disabled={!allValid} onClick={() => setStep(2)}>Siguiente<ArrowRight /></Button>
          </div>
        </div>
      </Card>
    </>
  )
}
