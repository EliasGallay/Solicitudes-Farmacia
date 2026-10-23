import { FileText, ImageOff, Paperclip } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { SignedNote } from '@/lib/signed-notes'
import { formatDateTime } from '@/lib/requests'

// Miniaturas de los remitos firmados de una entrega; cada una abre el archivo (enlace temporal) en otra pestaña.
export function SignedNoteThumbnails({ notes }: { notes: SignedNote[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {notes.map((note, index) => (
        <li key={note.id}>
          {note.url
            ? (
              <a href={note.url} target="_blank" rel="noreferrer" className="group flex w-36 flex-col gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                {note.isPdf
                  ? <span className="flex h-28 items-center justify-center rounded-md border border-border bg-surface-muted group-hover:border-primary-500"><FileText className="size-10 text-primary-600" aria-hidden /></span>
                  // eslint-disable-next-line @next/next/no-img-element -- enlace firmado temporal de Supabase Storage.
                  : <img src={note.url} alt={`Remito firmado ${index + 1}`} loading="lazy" className="h-28 w-full rounded-md border border-border bg-surface object-cover group-hover:border-primary-500" />}
                <span className="text-xs text-foreground-secondary">{note.isPdf ? 'PDF' : 'Foto'} · {formatDateTime(note.createdAt)}</span>
              </a>
            )
            : (
              <span className="flex h-28 w-36 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-muted text-xs text-foreground-secondary">
                <ImageOff className="size-6" aria-hidden />No disponible
              </span>
            )}
        </li>
      ))}
    </ul>
  )
}

// Enlaces compactos para el historial de la solicitud.
export function SignedNoteLinks({ notes }: { notes: SignedNote[] }) {
  return (
    <>
      {notes.filter((note) => note.url).map((note, index, list) => (
        <a key={note.id} href={note.url!} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          <Paperclip />Remito firmado{list.length > 1 ? ` ${index + 1}` : ''}
        </a>
      ))}
    </>
  )
}
