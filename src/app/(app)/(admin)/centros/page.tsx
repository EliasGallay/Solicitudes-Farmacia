import Link from 'next/link'
import { Building2, Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { createCenter, toggleCenter, updateCenter } from '@/app/center-actions'
import { CenterBadge } from '@/components/center-badge'
import { ConfirmSubmit } from '@/components/confirm-submit'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { FormError } from '@/components/form-feedback'
import { PageHeader } from '@/components/page-header'
import { ProductStatusBadge } from '@/components/products/product-status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { centerTone, type Center } from '@/lib/centers'
import { feedbackMessage } from '@/lib/feedback'
import { listHref } from '@/lib/filters'
import { requireRole } from '@/lib/session'

const PATH = '/centros'

// ?editar=<id>: el centro que se está renombrando.
const editingSchema = z.string().uuid().optional().catch(undefined)

type CenterRow = Center & { tone: number; userCount: number }

export default async function CentersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireRole('admin')
  const params = await searchParams
  const editing = editingSchema.parse(params.editar)
  const creating = params.nuevo === '1'

  // profiles(count): usuarios asignados al centro, activos o no. Son pocos centros: sin filtros ni paginado.
  const { data, error } = await supabase.from('health_centers').select('id, name, active, profiles(count)').order('name')
  const centers = (data ?? []).map((center) => ({ id: center.id as string, name: center.name as string, active: center.active as boolean }))
  const rows: CenterRow[] = (data ?? []).map((center, index) => ({
    ...centers[index],
    tone: centerTone(centers, center.id as string),
    userCount: (center.profiles as { count: number }[] | null)?.[0]?.count ?? 0,
  }))

  return (
    <>
      <PageHeader
        title="Centros"
        description="Administrá los centros de salud que hacen solicitudes."
        actions={<Link href={listHref(PATH, { nuevo: '1' })} className={buttonVariants()}><Plus />Nuevo centro</Link>}
      />
      {feedbackMessage(params.error) && <div className="mb-6"><FormError>{feedbackMessage(params.error)}</FormError></div>}

      {creating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nuevo centro</CardTitle>
            <CardDescription>Después podés asignarle usuarios desde Usuarios. El nombre se puede cambiar más adelante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCenter} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="centro-nombre">Nombre</Label>
                <Input id="centro-nombre" name="name" required maxLength={80} placeholder="Ej.: Centro de Salud Oñativia" autoFocus />
              </div>
              <Link href={PATH} className={buttonVariants({ variant: 'secondary' })}>Cancelar</Link>
              <Button type="submit">Agregar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        {error ? <ErrorState title="No pudimos cargar los centros" />
          : rows.length === 0 ? (
            <EmptyState icon={Building2} title="Todavía no hay centros" action={<Link href={listHref(PATH, { nuevo: '1' })} className={buttonVariants()}><Plus />Nuevo centro</Link>} />
          ) : (
            <CardContent className="pt-5">
              <MobileList>
                {rows.map((row) => (
                  <MobileListItem key={row.id}>
                    {editing === row.id ? <RenameForm row={row} /> : (
                      <>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <CenterBadge name={row.name} tone={row.tone} />
                          <ProductStatusBadge active={row.active} />
                        </div>
                        <p className="mt-1 text-xs leading-4"><UserCount row={row} /></p>
                        <div className="mt-2 flex gap-2"><RowActions row={row} /></div>
                      </>
                    )}
                  </MobileListItem>
                ))}
              </MobileList>
              <Table containerClassName="hidden md:block">
                <TableHeader>
                  <TableRow>
                    <TableHead>Centro</TableHead>
                    <TableHead className="text-right">Usuarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => editing === row.id ? (
                    <TableRow key={row.id}>
                      <TableCell colSpan={4}><RenameForm row={row} /></TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={row.id}>
                      <TableCell><CenterBadge name={row.name} tone={row.tone} /></TableCell>
                      <TableCell className="text-right tabular-nums"><UserCount row={row} /></TableCell>
                      <TableCell><ProductStatusBadge active={row.active} /></TableCell>
                      <TableCell><div className="flex justify-end gap-1"><RowActions row={row} /></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
      </Card>
    </>
  )
}

// Cantidad de usuarios con enlace al listado de usuarios filtrado por el centro.
function UserCount({ row }: { row: CenterRow }) {
  const text = `${row.userCount} ${row.userCount === 1 ? 'usuario' : 'usuarios'}`
  if (row.userCount === 0) return <span className="text-foreground-secondary">{text}</span>
  return <Link href={listHref('/usuarios', { centro: row.id })} className="text-primary-600 hover:text-primary-700 hover:underline">{text}</Link>
}

function RowActions({ row }: { row: CenterRow }) {
  // Desactivar el centro no desactiva a sus usuarios: eso se hace desde Usuarios.
  const users = row.userCount === 0 ? 'No tiene usuarios asignados.' : `${row.userCount === 1 ? 'Su usuario sigue activo' : `Sus ${row.userCount} usuarios siguen activos`}: desactivalos desde Usuarios si ya no deben ingresar.`
  return (
    <>
      <Link href={listHref(PATH, { editar: row.id })} scroll={false} aria-label={`Renombrar ${row.name}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}><Pencil />Editar</Link>
      <form action={toggleCenter}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="active" value={String(row.active)} />
        <ConfirmSubmit
          size="sm"
          tone={row.active ? 'destructive' : 'default'}
          title={row.active ? `Desactivar el centro ${row.name}` : `Reactivar el centro ${row.name}`}
          description={row.active ? `Deja de ofrecerse al crear usuarios y solicitudes; su historial se conserva. ${users}` : 'Vuelve a ofrecerse al crear usuarios y solicitudes.'}
        >
          {row.active ? 'Desactivar' : 'Reactivar'}
        </ConfirmSubmit>
      </form>
    </>
  )
}

function RenameForm({ row }: { row: CenterRow }) {
  return (
    <form action={updateCenter} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={row.id} />
      <Input name="name" aria-label={`Nuevo nombre del centro ${row.name}`} defaultValue={row.name} required maxLength={80} autoFocus className="min-w-0 flex-1 sm:max-w-xs" />
      <Button type="submit" size="sm">Guardar</Button>
      <Link href={PATH} scroll={false} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Cancelar</Link>
    </form>
  )
}
