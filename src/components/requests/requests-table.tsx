import Link from 'next/link'
import { ArrowRight, CalendarDays, ChevronRight, Clock, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { MobileList, MobileListItem } from '@/components/ui/mobile-list'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CenterBadge, centerRowTones } from '@/components/center-badge'
import { ReceiptBadges, StatusBadge } from '@/components/status-badge'
import type { RequestStatus } from '@/lib/request-status'
import { formatDateTime, formatRequestNumber, formatWait, WAIT_WARNING_DAYS } from '@/lib/requests'
import { cn } from '@/lib/utils'

// `area`: nombre del rubro, solo cuando el usuario ve más de uno.
// `center`: centro de salud con su color (centerTone), solo para el admin.
// `waitDays`: días de espera de una solicitud abierta, solo en la bandeja del admin.
// `unconfirmed` / `discrepancy`: hay entregas sin confirmar o recepciones con diferencia sin resolver.
// `purchase`: tiene requerimiento de compra (con entrega parcial se ve también "En compras").
export type RequestRow = { id: string; number: number; createdAt: string; productCount: number; status: RequestStatus; purchase?: boolean; area?: string; center?: { name: string; tone: number }; waitDays?: number; unconfirmed?: boolean; discrepancy?: boolean }

function WaitLabel({ days }: { days: number }) {
  const late = days >= WAIT_WARNING_DAYS
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', late && 'font-semibold text-warning')}>{late && <Clock className="size-3.5" aria-hidden />}{formatWait(days)}</span>
}

// Último movimiento queda fuera hasta que el backend lo provea.
// Debajo de md cada solicitud es un enlace a su detalle (o una tarjeta propia con `mobileCards`); desde
// md, tabla. `areaColumn`: muestra la columna Rubro; por defecto, cuando alguna fila trae rubro.
export function RequestsTable({ rows, mobileCards = false, areaColumn }: { rows: RequestRow[]; mobileCards?: boolean; areaColumn?: boolean }) {
  const showArea = areaColumn ?? rows.some((row) => row.area)
  const showCenter = rows.some((row) => row.center)
  const showWait = rows.some((row) => row.waitDays !== undefined)
  return (
    <>
      {mobileCards ? <RequestCards rows={rows} /> : <MobileList>
        {rows.map((row) => {
          const number = formatRequestNumber(row.number)
          return (
            <MobileListItem key={row.id} className="py-0 first:pt-0 last:pb-0">
              <Link href={`/solicitudes/${row.id}`} aria-label={`Ver solicitud ${number}`} className={cn('-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500', row.center && ['pl-4', centerRowTones[row.center.tone]])}>
                <div className="min-w-0 flex-1">
                  {row.center && <CenterBadge name={row.center.name} tone={row.center.tone} className="mb-1.5" />}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm leading-5 font-semibold text-foreground">{number}</span>
                    <StatusBadge status={row.status} purchase={row.purchase} />
                    <ReceiptBadges unconfirmed={row.unconfirmed} discrepancy={row.discrepancy} />
                    {row.area && <Badge>{row.area}</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-4 text-foreground-secondary">{formatDateTime(row.createdAt)} · {row.productCount} {row.productCount === 1 ? 'producto' : 'productos'}{row.waitDays !== undefined && <> · Espera: <WaitLabel days={row.waitDays} /></>}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </MobileListItem>
          )
        })}
      </MobileList>}
      <Table containerClassName="hidden md:block">
        <TableHeader>
          <TableRow>
            <TableHead>N° solicitud</TableHead>
            {showCenter && <TableHead>Centro de salud</TableHead>}
            {showArea && <TableHead>Rubro</TableHead>}
            <TableHead>Fecha</TableHead>
            {showWait && <TableHead>Espera</TableHead>}
            <TableHead className="text-right">Productos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const number = formatRequestNumber(row.number)
            return (
              <TableRow key={row.id}>
                <TableCell className={cn('font-semibold whitespace-nowrap', row.center && centerRowTones[row.center.tone])}>{number}</TableCell>
                {showCenter && <TableCell>{row.center && <CenterBadge name={row.center.name} tone={row.center.tone} />}</TableCell>}
                {showArea && <TableCell>{row.area && <Badge>{row.area}</Badge>}</TableCell>}
                <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                {showWait && <TableCell>{row.waitDays !== undefined ? <WaitLabel days={row.waitDays} /> : <span className="text-foreground-muted">—</span>}</TableCell>}
                <TableCell className="text-right tabular-nums">{row.productCount}</TableCell>
                <TableCell><div className="flex flex-wrap gap-1"><StatusBadge status={row.status} purchase={row.purchase} /><ReceiptBadges unconfirmed={row.unconfirmed} discrepancy={row.discrepancy} /></div></TableCell>
                <TableCell className="text-right">
                  <Link href={`/solicitudes/${row.id}`} aria-label={`Ver solicitud ${number}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver<ArrowRight /></Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}

// Tarjetas de mobile del listado de solicitudes: número y estado, rubro, fecha y productos, y el
// botón para abrirla. El centro (admin) se marca con su color como en la tabla.
function RequestCards({ rows }: { rows: RequestRow[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => {
        const number = formatRequestNumber(row.number)
        return (
          <li key={row.id} className={cn('rounded-lg border border-border bg-surface p-4 shadow-card', row.center && ['pl-5', centerRowTones[row.center.tone]])}>
            {row.center && <CenterBadge name={row.center.name} tone={row.center.tone} className="mb-2" />}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl leading-7 font-bold text-foreground">{number}</h2>
              <div className="flex flex-wrap justify-end gap-1"><StatusBadge status={row.status} purchase={row.purchase} /><ReceiptBadges unconfirmed={row.unconfirmed} discrepancy={row.discrepancy} /></div>
            </div>
            {row.area && <p className="mt-2 flex items-center gap-2 text-sm leading-5 text-foreground"><Package className="size-4 shrink-0 text-foreground-secondary" aria-hidden />{row.area}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-sm leading-5 text-foreground-secondary">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" aria-hidden />{formatDateTime(row.createdAt)}</span>
              <span aria-hidden className="h-4 w-px bg-border" />
              <span className="flex items-center gap-1.5"><Package className="size-4 shrink-0" aria-hidden />{row.productCount} {row.productCount === 1 ? 'producto' : 'productos'}</span>
              {row.waitDays !== undefined && <span className="basis-full">Espera: <WaitLabel days={row.waitDays} /></span>}
            </div>
            <Link href={`/solicitudes/${row.id}`} aria-label={`Ver solicitud ${number}`} className={cn(buttonVariants({ variant: 'secondary' }), 'relative mt-4 w-full')}>
              Ver solicitud<ChevronRight className="absolute right-3" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function RequestsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando solicitudes">
      <Skeleton className="hidden h-10 w-full md:block" />
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-12 w-full md:h-9" />)}
    </div>
  )
}
