import { z } from 'zod'
import type { AppRole } from './session'

// Validación compartida por el formulario de usuarios (cliente) y las server actions.
// La base repite las reglas de rol, centro y rubros en admin_save_user.

export const userRoles = ['requester', 'admin'] as const satisfies readonly AppRole[]

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  requester: 'Solicitante',
}

export const PASSWORD_MIN_LENGTH = 8

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, `Usá al menos ${PASSWORD_MIN_LENGTH} caracteres`).max(72, 'Máximo 72 caracteres')

const fullNameSchema = z.string().trim().min(1, 'El nombre es obligatorio').max(120, 'Máximo 120 caracteres')

const userFields = z.object({
  full_name: fullNameSchema,
  email: z.string().trim().toLowerCase().email('Ingresá un email válido'),
  role: z.enum(userRoles, { errorMap: () => ({ message: 'Seleccioná un rol' }) }),
  health_center_id: z.string().optional(),
  areas: z.array(z.string()),
})

// El solicitante necesita centro y al menos un rubro; el admin no usa ninguno de los dos.
function requesterRules(values: z.infer<typeof userFields>, ctx: z.RefinementCtx) {
  if (values.role !== 'requester') return
  if (!z.string().uuid().safeParse(values.health_center_id).success) ctx.addIssue({ code: 'custom', path: ['health_center_id'], message: 'Seleccioná el centro de salud' })
  if (values.areas.length === 0) ctx.addIssue({ code: 'custom', path: ['areas'], message: 'Seleccioná al menos un rubro' })
}

export const userSchema = userFields.superRefine(requesterRules)
export const newUserSchema = userFields.extend({ password: passwordSchema }).superRefine(requesterRules)
// Mismo formulario en edición: la contraseña se gestiona aparte y no se valida acá.
export const editUserFormSchema = userFields.extend({ password: z.string() }).superRefine(requesterRules)

// Datos personales que cada usuario edita por su cuenta en /perfil (update_own_profile).
export const profileSchema = z.object({ full_name: fullNameSchema })

export type UserValues = z.infer<typeof userSchema>
export type ProfileValues = z.infer<typeof profileSchema>
export type NewUserValues = z.infer<typeof newUserSchema>

// Iniciales para el avatar: primera y última palabra del nombre ('María del Carmen López' → 'ML').
export function initials(fullName: string) {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]]
  return letters.join('').toLocaleUpperCase('es')
}

// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla o copiarla a mano.
const PASSWORD_GROUPS = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789']

// Contraseña temporal aleatoria con minúsculas, mayúsculas y números garantizados.
export function generateTemporaryPassword(length = 12) {
  const all = PASSWORD_GROUPS.join('')
  const random = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max
  const chars = PASSWORD_GROUPS.map((group) => group[random(group.length)])
  while (chars.length < length) chars.push(all[random(all.length)])
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1)
    ;[chars[index], chars[swap]] = [chars[swap], chars[index]]
  }
  return chars.join('')
}
