'use client'

import { useId, useRef, type CSSProperties } from 'react'
import { CalendarPlus, Eye, Pencil, UserCheck, UserMinus } from 'lucide-react'
import Link from 'next/link'
import { setStaffMemberActive } from '@/app/staff-actions'
import { Button } from '@/components/ui/button'

// Menú «⋯» de una fila. El menú es un popover nativo (top layer): ningún overflow del contenedor de la
// tabla lo recorta, y se cierra con Esc o al tocar afuera. Se posiciona junto al botón y se da vuelta hacia
// arriba si en la fila de abajo no hay lugar. La confirmación de baja es un diálogo aparte, fuera del menú,
// para que cerrar el menú no la afecte.
// Requiere Popover API + anchor positioning (Chrome / Edge). En otros navegadores el menú se abre sin posición.

const PATH = '/personal'

export function RowActions({ member }: { member: { id: string; firstName: string; lastName: string; active: boolean } }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const menuId = `row-menu-${uid}`
  const anchor = `--row-anchor-${uid}`
  const deactivateRef = useRef<HTMLDialogElement>(null)
  const name = `${member.lastName}, ${member.firstName}`

  // Estilos de anchor positioning: no están tipados en React, por eso el cast.
  const buttonStyle = { anchorName: anchor } as CSSProperties
  const menuStyle = {
    positionAnchor: anchor,
    positionArea: 'bottom span-left',
    positionTryFallbacks: 'flip-block',
  } as CSSProperties

  return (
    <>
      {/* Ojo y ⋯ en un mismo grupo, con la misma altura y alineados a la derecha de la celda. */}
      <span className="inline-flex items-center justify-end gap-1">
      <Link
        href={`${PATH}/${member.id}`}
        aria-label={`Ver ficha de ${name}`}
        title="Ver ficha"
        className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Eye className="size-4" aria-hidden />
      </Link>

      <button
        type="button"
        popoverTarget={menuId}
        aria-label={`Acciones de ${name}`}
        aria-haspopup="menu"
        style={buttonStyle}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-lg hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        ⋯
      </button>
      </span>

      <div
        id={menuId}
        popover="auto"
        role="menu"
        style={menuStyle}
        className="m-0 mt-1 hidden open:grid w-56 gap-1 rounded-md border border-border bg-surface p-1 text-left shadow-md"
      >
        <Link role="menuitem" href={`${PATH}/${member.id}?licencia=1`} className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-surface-hover"><CalendarPlus className="size-4 text-foreground-secondary" aria-hidden />Registrar licencia</Link>
        <Link role="menuitem" href={`${PATH}/${member.id}?editar=1`} className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-surface-hover"><Pencil className="size-4 text-foreground-secondary" aria-hidden />Editar ficha</Link>
        {member.active ? (
          <>
            <hr className="my-1 border-border" />
            <button
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
              onClick={() => {
                document.getElementById(menuId)?.hidePopover()
                deactivateRef.current?.showModal()
              }}
            >
              <UserMinus className="size-4" aria-hidden />
              Dar de baja
            </button>
          </>
        ) : (
          <form action={setStaffMemberActive}>
            <input type="hidden" name="staff_member_id" value={member.id} />
            <button type="submit" name="active" value="true" role="menuitem" className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-surface-hover">
              <UserCheck className="size-4 text-foreground-secondary" aria-hidden />
              Reactivar
            </button>
          </form>
        )}
      </div>

      {member.active ? (
        <dialog
          ref={deactivateRef}
          aria-labelledby={`deactivate-${uid}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) deactivateRef.current?.close()
          }}
          className="m-auto hidden open:flex w-[min(28rem,calc(100vw-2rem))] flex-col rounded-lg border border-border-strong bg-surface p-0 text-left text-foreground shadow-card backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        >
          <form action={setStaffMemberActive} className="grid gap-4 p-6">
            <input type="hidden" name="staff_member_id" value={member.id} />
            <div className="grid gap-1">
              <h2 id={`deactivate-${uid}`} className="text-lg font-semibold">¿Dar de baja a {name}?</h2>
              <p className="text-sm text-foreground-secondary">Deja de figurar en el listado de activos. Su historial se conserva.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => deactivateRef.current?.close()}>Cancelar</Button>
              <Button type="submit" name="active" value="false" variant="destructive">Dar de baja</Button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  )
}
