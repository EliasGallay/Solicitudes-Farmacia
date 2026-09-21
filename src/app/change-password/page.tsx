import { changePassword } from './actions'
import { logout } from '../login/actions'

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Cambiar contraseña</h1>
      <p className="mt-2 text-slate-600">Por seguridad, definí una contraseña nueva antes de continuar.</p>
      {params.error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      <form action={changePassword} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">
          Nueva contraseña
          <input name="password" type="password" minLength={8} required autoComplete="new-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Repetir contraseña
          <input name="confirmation" type="password" minLength={8} required autoComplete="new-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Guardar contraseña</button>
      </form>
      <form action={logout} className="mt-4 text-center">
        <button type="submit" className="text-sm text-slate-600 underline hover:text-slate-900">Cerrar sesión y volver al login</button>
      </form>
    </main>
  )
}
