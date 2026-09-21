'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSupabaseServerClient } from '../lib/supabase/server'

const productSchema = z.object({
  name: z.string().trim().min(1).max(150),
  presentation: z.string().trim().min(1).max(150),
})

const idSchema = z.string().uuid()

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role !== 'admin') redirect('/catalogos?error=Solo+un+administrador+puede+gestionar+productos')
  return supabase
}

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse({ name: formData.get('name'), presentation: formData.get('presentation') })
  if (!parsed.success) redirect('/catalogos?error=Completá+nombre+y+presentación')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('products').insert({ ...parsed.data, is_test_data: false })
  if (error) redirect(`/catalogos?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/catalogos')
  revalidatePath('/nueva-solicitud')
  redirect('/catalogos?success=Producto+creado')
}

export async function updateProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const product = productSchema.safeParse({ name: formData.get('name'), presentation: formData.get('presentation') })
  if (!id.success || !product.success) redirect('/catalogos?error=Datos+de+producto+inválidos')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('products').update(product.data).eq('id', id.data)
  if (error) redirect(`/catalogos?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/catalogos')
  revalidatePath('/nueva-solicitud')
  redirect('/catalogos?success=Producto+actualizado')
}

export async function toggleProduct(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  const active = formData.get('active') === 'true'
  if (!id.success) redirect('/catalogos?error=Producto+inválido')

  const supabase = await requireAdmin()
  const { error } = await supabase.from('products').update({ active: !active }).eq('id', id.data)
  if (error) redirect(`/catalogos?error=${encodeURIComponent(error.message)}`)
  revalidatePath('/catalogos')
  revalidatePath('/nueva-solicitud')
  redirect(`/catalogos?success=Producto+${active ? 'desactivado' : 'reactivado'}`)
}
