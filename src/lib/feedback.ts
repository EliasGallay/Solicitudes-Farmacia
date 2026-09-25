// Mensajes de resultado que viajan por URL (?error= / ?success=) como códigos ASCII.
// La URL nunca transporta texto libre: se evita el mal encoding de tildes y que un enlace
// manipulado muestre mensajes arbitrarios. Tampoco se exponen mensajes técnicos del backend.
const messages = {
  'login-invalido': 'Ingresá un email y una contraseña válidos.',
  'login-fallido': 'No se pudo iniciar sesión. Revisá tu email y contraseña.',
  'sesion-expirada': 'La sesión expiró. Iniciá sesión nuevamente.',
  'password-invalida': 'La contraseña debe tener al menos 8 caracteres y ambas deben coincidir.',
  'password-igual': 'La nueva contraseña debe ser distinta de la actual.',
  'password-debil': 'La contraseña es demasiado débil. Probá con una más larga o combinada.',
  'password-error': 'No se pudo cambiar la contraseña. Intentá nuevamente.',
  'recuperacion-invalida': 'Ingresá un email válido.',
  'recuperacion-enviada': 'Si el email corresponde a una cuenta habilitada, te enviamos un enlace para crear una nueva contraseña. Revisá tu bandeja de entrada y la carpeta de spam.',
  'recuperacion-error': 'No pudimos enviar el enlace en este momento. Esperá unos minutos e intentá nuevamente.',
  'enlace-invalido': 'El enlace para restablecer la contraseña no es válido o ya venció. Pedí uno nuevo.',
  'solo-admin': 'Solo un administrador puede gestionar el catálogo.',
  'producto-incompleto': 'Completá nombre, presentación y tipo.',
  'producto-invalido': 'Los datos del producto no son válidos.',
  'producto-duplicado': 'Ya existe un producto con ese nombre y presentación.',
  'producto-error': 'No se pudo guardar el producto. Intentá nuevamente.',
  'producto-creado': 'Producto creado.',
  'producto-actualizado': 'Producto actualizado.',
  'producto-desactivado': 'Producto desactivado.',
  'producto-reactivado': 'Producto reactivado.',
} as const

export type FeedbackCode = keyof typeof messages

// Texto del código recibido por URL; los códigos desconocidos se ignoran.
export function feedbackMessage(code: string | undefined) {
  return code && Object.hasOwn(messages, code) ? messages[code as FeedbackCode] : undefined
}

export function withFeedback(path: string, kind: 'error' | 'success', code: FeedbackCode) {
  return `${path}?${kind}=${code}`
}
