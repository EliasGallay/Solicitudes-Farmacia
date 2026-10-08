'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { feedbackMessage, withFeedback } from '../lib/feedback'
import { notificationHref } from '../lib/notifications'
import { requireSession } from '../lib/session'

// Notificaciones (supabase/migrations/202610080001_notifications.sql). RLS limita cada consulta a las
// propias y mark_notifications_read solo marca las de quien la llama.

const idSchema = z.string().uuid()

// Abre una notificación: la marca como leída y lleva a la pantalla correspondiente.
export async function openNotification(formData: FormData) {
  const id = idSchema.safeParse(formData.get('id'))
  if (!id.success) redirect(withFeedback('/notificaciones', 'error', 'notificacion-invalida'))

  const { supabase } = await requireSession()
  const { data: notification } = await supabase.from('notifications').select('kind, request_id, read_at').eq('id', id.data).maybeSingle()
  if (!notification) redirect(withFeedback('/notificaciones', 'error', 'notificacion-invalida'))

  if (!notification.read_at) {
    await supabase.rpc('mark_notifications_read', { notification_ids: [id.data] })
    revalidatePath('/notificaciones')
  }
  redirect(notificationHref(notification.kind as string, notification.request_id as string))
}

export async function markAllNotificationsRead() {
  const { supabase } = await requireSession()
  const { error } = await supabase.rpc('mark_notifications_read', { notification_ids: null })
  if (error) redirect(withFeedback('/notificaciones', 'error', 'notificaciones-error'))
  revalidatePath('/notificaciones')
  redirect(withFeedback('/notificaciones', 'success', 'notificaciones-leidas'))
}

// Panel de la campana: marca todas sin salir de la página y devuelve el error para mostrarlo ahí.
export async function markAllNotificationsReadInPanel(): Promise<{ error: string | null }> {
  const { supabase } = await requireSession()
  const { error } = await supabase.rpc('mark_notifications_read', { notification_ids: null })
  if (error) return { error: feedbackMessage('notificaciones-error')! }
  revalidatePath('/notificaciones')
  return { error: null }
}
