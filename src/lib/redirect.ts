import { redirect, RedirectType } from 'next/navigation'

// Redirección después de una acción de servidor. Reemplaza la entrada del formulario en el historial
// (en vez de apilar otra), así "Volver" no regresa a un formulario ya enviado.
export function redirectAfterAction(url: string): never {
  return redirect(url, RedirectType.replace)
}
