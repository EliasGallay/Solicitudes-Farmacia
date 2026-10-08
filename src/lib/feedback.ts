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
  'solo-admin': 'Solo un administrador puede acceder a esta sección.',
  'sin-rubro': 'No tenés habilitado ese rubro.',
  'producto-incompleto': 'Completá rubro, nombre, presentación y tipo.',
  'producto-invalido': 'Los datos del producto no son válidos.',
  'producto-duplicado': 'Ya existe un producto con ese nombre y presentación en el rubro.',
  'producto-error': 'No se pudo guardar el producto. Intentá nuevamente.',
  'producto-creado': 'Producto creado.',
  'producto-actualizado': 'Producto actualizado.',
  'producto-desactivado': 'Producto desactivado.',
  'producto-reactivado': 'Producto reactivado.',
  'tipo-invalido': 'Completá el rubro y un nombre de tipo que tenga letras.',
  'tipo-duplicado': 'Ya existe ese tipo en el rubro.',
  'tipo-error': 'No se pudo guardar el tipo. Intentá nuevamente.',
  'tipo-creado': 'Tipo creado.',
  'tipo-actualizado': 'Tipo actualizado.',
  'tipo-desactivado': 'Tipo desactivado. Los productos que lo usan lo conservan.',
  'tipo-reactivado': 'Tipo reactivado.',
  'usuario-creado': 'Usuario creado. Compartile el email y la contraseña temporal: la va a tener que cambiar al ingresar.',
  'usuario-actualizado': 'Datos del usuario actualizados.',
  'usuario-password': 'Contraseña temporal asignada. El usuario la va a tener que cambiar al ingresar.',
  'usuario-desactivado': 'Usuario desactivado. Ya no puede ingresar al sistema.',
  'usuario-reactivado': 'Usuario reactivado. Ya puede volver a ingresar.',
  'usuario-eliminado': 'Usuario eliminado.',
  'usuario-invalido': 'El usuario indicado no es válido.',
  'usuario-propio': 'No podés desactivar ni eliminar tu propia cuenta.',
  'usuario-con-actividad': 'El usuario tiene solicitudes o entregas registradas: desactivalo en lugar de eliminarlo.',
  'usuario-error': 'No se pudo completar la acción sobre el usuario. Intentá nuevamente.',
  'usuario-bloqueo-error': 'El perfil se actualizó, pero no se pudo cambiar el acceso de la cuenta. Intentá nuevamente.',
  'usuario-eliminado-parcial': 'Se eliminó el perfil, pero no la cuenta de acceso. Revisala en Supabase > Authentication.',
  'entrega-registrada': 'Entrega registrada.',
  'entrega-anulada': 'Entrega anulada. Sus cantidades volvieron a quedar pendientes.',
  'pendiente-cerrado': 'Pendiente cerrado. Esas cantidades ya no se van a entregar.',
  'solicitud-cancelada': 'Solicitud cancelada.',
  'gestion-sobreentrega': 'La cantidad supera lo pendiente del producto. Revisá las cantidades: puede que otra operación haya cambiado la solicitud.',
  'gestion-entrega-vacia': 'Indicá al menos un producto con cantidad a entregar.',
  'gestion-sin-pendiente': 'No hay cantidades pendientes para cerrar en los productos elegidos.',
  'gestion-motivo-requerido': 'Indicá el motivo.',
  'gestion-ya-anulada': 'La entrega ya estaba anulada.',
  'gestion-con-entregas': 'La solicitud ya tiene entregas: no se puede cancelar. Consultá con la administración.',
  'gestion-nota-larga': 'El texto puede tener hasta 500 caracteres.',
  'gestion-datos-invalidos': 'Los datos de la operación no son válidos. Recargá la página e intentá nuevamente.',
  'gestion-error': 'No se pudo completar la operación. Intentá nuevamente.',
  'gestion-con-recepcion': 'El centro ya confirmó la recepción de esta entrega: no se puede anular.',
  'recepcion-confirmada': 'Recepción confirmada.',
  'recepcion-confirmada-parcial': 'Recepción confirmada para los productos marcados. Todavía quedan productos entregados sin confirmar.',
  'recepcion-vacia': 'Marcá al menos un producto como recibido.',
  'recepcion-ya-confirmada': 'Alguno de los productos ya estaba confirmado. Recargá la página.',
  'recepcion-comentario-requerido': 'Si la cantidad recibida es menor a la entregada, describí la diferencia.',
  'recepcion-entrega-anulada': 'Alguna de las entregas fue anulada. Recargá la página.',
  'diferencia-resuelta': 'Diferencia resuelta.',
  'diferencia-ya-resuelta': 'La diferencia ya estaba resuelta.',
  'perfil-actualizado': 'Tus datos se actualizaron.',
  'perfil-password': 'Tu contraseña se actualizó.',
  'notificaciones-leidas': 'Marcamos todas las notificaciones como leídas.',
  'notificacion-invalida': 'La notificación no existe o ya no está disponible.',
  'notificaciones-error': 'No se pudieron actualizar las notificaciones. Intentá nuevamente.',
} as const

export type FeedbackCode = keyof typeof messages

// Texto del código recibido por URL; los códigos desconocidos se ignoran.
export function feedbackMessage(code: string | undefined) {
  return code && Object.hasOwn(messages, code) ? messages[code as FeedbackCode] : undefined
}

// `path` puede traer su propia query (ej. /catalogos/tipos?nuevo=1).
export function withFeedback(path: string, kind: 'error' | 'success', code: FeedbackCode) {
  return `${path}${path.includes('?') ? '&' : '?'}${kind}=${code}`
}
