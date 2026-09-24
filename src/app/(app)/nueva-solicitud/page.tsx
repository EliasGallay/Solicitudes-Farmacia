import { redirect } from 'next/navigation'

// Ruta anterior: la creación de solicitudes (incluido el admin) está unificada en /solicitudes/nueva.
export default function LegacyNewRequestPage() {
  redirect('/solicitudes/nueva')
}
