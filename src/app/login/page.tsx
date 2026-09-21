import { login } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <span className="mb-4 w-fit rounded-full bg-slate-200 px-3 py-1 text-sm font-medium">Solicitudes de Farmacia</span>
      <h1 className="text-3xl font-bold tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-slate-600">Ingresá con tu usuario habilitado.</p>
      {params.error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p>}
      <form action={login} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" className="w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
          Ingresar
        </button>
      </form>
    </main>
  )
}
