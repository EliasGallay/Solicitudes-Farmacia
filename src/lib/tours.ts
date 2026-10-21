import type { AppRole } from './session'

// Recorridos guiados por pantalla (docs/plans/plan-ajustes-devoluciones.md, tutoriales). Solo datos: los
// muestra TourController (src/components/product-tour.tsx).
//
// - `target`: valor del atributo data-tour del elemento que se señala. tests/tours.test.ts verifica que
//   cada uno exista en el código.
// - `optional`: el elemento puede no estar (depende de los datos o del ancho de pantalla); si falta, el
//   paso se saltea. Los no opcionales se esperan antes de arrancar el recorrido automático.
// - `version`: subirla cuando la pantalla cambie lo suficiente como para volver a mostrar el recorrido
//   automático a quienes ya lo vieron.
//
// Cada paso responde qué es, para qué sirve y qué pasa al usarlo. Máximo 5 o 6 pasos por recorrido.

export type TourStep = { target: string; title: string; description: string; items?: string[]; optional?: boolean }
export type ScreenTour = { id: string; version: number; roles: AppRole[]; path: RegExp; steps: TourStep[] }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

// Significado de cada estado, compartido por los recorridos que lo explican.
const statusItems = [
  '<b>Pendiente</b>: todavía no se entregó nada.',
  '<b>En compras</b>: la administración pidió a compras lo que falta. Si ya llegó una parte, se ve junto a «Entrega parcial».',
  '<b>Entrega parcial</b>: llegó una parte; el resto sigue pendiente.',
  '<b>Entregada</b>: se entregó todo; falta que confirmes la recepción.',
  '<b>Recibida</b>: confirmaste todo y no quedan diferencias abiertas.',
  '<b>Cerrada</b>: no se va a entregar (cancelada o cerrada por la administración).',
]

export const screenTours: ScreenTour[] = [
  {
    id: 'inicio-solicitante',
    version: 1,
    roles: ['requester'],
    path: /^\/$/,
    steps: [
      { target: 'home-new-request', title: 'Nueva solicitud', description: 'Empezá un pedido de insumos para tu centro: elegís los productos, las cantidades y lo enviás a la administración.' },
      {
        target: 'home-metrics',
        title: 'Resumen de tus solicitudes',
        description: 'Cuántas solicitudes tenés en cada situación. Tocá cualquiera para ver ese listado.',
        items: ['<b>Pendientes</b>: todavía no se entregó nada.', '<b>En compras</b>: la administración pidió a compras lo que falta (puede haber llegado una parte).', '<b>Entregas parciales</b>: llegó una parte.', '<b>Por confirmar recepción</b>: hay entregas que tenés que revisar y confirmar.'],
      },
      { target: 'home-recent', title: 'Últimas solicitudes', description: 'Las cinco más recientes con su estado. Tocá una para ver el detalle, las entregas y el historial.' },
      { target: 'home-pending', title: 'Productos pendientes de recibir', description: 'Lo que todavía falta que te entreguen, producto por producto, con la solicitud a la que pertenece.' },
      { target: 'nav-pending-receipts', title: 'Por confirmar', description: 'Acceso directo a las solicitudes con entregas que tenés que confirmar. El número indica cuántas hay.', optional: true },
    ],
  },
  {
    id: 'solicitudes-solicitante',
    version: 1,
    roles: ['requester'],
    path: /^\/solicitudes$/,
    steps: [
      { target: 'requests-filters', title: 'Buscar y filtrar', description: 'Buscá por número (por ejemplo #SOL-12) o por producto, y acotá por estado o por fechas. Los filtros quedan en la dirección de la página: podés guardar o compartir el enlace.' },
      {
        target: 'requests-status-filter',
        title: 'Estados de una solicitud',
        description: 'El estado se calcula solo, según lo entregado, lo confirmado y lo cerrado:',
        items: [...statusItems, '<b>Por confirmar recepción</b> y <b>Con diferencia</b> muestran las que tienen algo para revisar.'],
      },
      { target: 'requests-list', title: 'Tus solicitudes', description: 'Cada una con su número, fecha, cantidad de productos y estado. Los avisos «Por confirmar» y «Con diferencia» indican que hay algo para revisar. Tocá una para abrirla.' },
      { target: 'requests-new', title: 'Nueva solicitud', description: 'Desde acá también podés empezar un pedido nuevo.' },
    ],
  },
  {
    id: 'detalle-solicitante',
    version: 1,
    roles: ['requester'],
    path: new RegExp(`^/solicitudes/${UUID}$`),
    steps: [
      { target: 'detail-status', title: 'Estado de la solicitud', description: 'Se actualiza solo con cada entrega, confirmación o cierre; no hace falta cambiarlo a mano.', items: statusItems },
      { target: 'detail-actions', title: 'Qué podés hacer ahora', description: 'Acá aparece la acción disponible: <b>Confirmar recepción</b> cuando llegó una entrega, o <b>Cancelar solicitud</b> mientras no se haya entregado nada (no se puede deshacer).', optional: true },
      { target: 'detail-metrics', title: 'Cantidades', description: 'Productos y unidades pedidas, entregadas y pendientes de toda la solicitud. Debajo, la barra muestra el avance de la entrega.' },
      { target: 'detail-products', title: 'Productos', description: 'El detalle de cada producto: solicitado, entregado, pendiente y su estado. Podés buscar uno o ver solo los que tienen pendiente.' },
      { target: 'detail-history', title: 'Historial', description: 'Todo lo que pasó, con fecha y quién lo hizo: creación, entregas con su remito, recepciones, diferencias y cierres. En cada entrega confirmada podés imprimir la constancia de recepción.' },
    ],
  },
  {
    id: 'recibir-solicitante',
    version: 1,
    roles: ['requester'],
    path: new RegExp(`^/solicitudes/${UUID}/recibir$`),
    steps: [
      {
        target: 'receipt-options',
        title: 'Revisá cada producto',
        description: 'Agrupados por remito. Para cada uno elegí:',
        items: ['<b>Recibido conforme</b>: llegó todo bien.', '<b>Con diferencia</b>: llegó menos; indicás cuánto y por qué.', '<b>Producto equivocado</b>: llegó otra cosa en su lugar; contás qué llegó.'],
      },
      { target: 'receipt-mark-all', title: 'Marcar todo', description: 'Si todo llegó bien, marcá todo como recibido conforme de una vez. No pisa las diferencias que ya cargaste.' },
      { target: 'receipt-submit', title: 'Confirmar recepción', description: 'Registra lo que marcaste; lo confirmado no se puede modificar. Lo que no marques queda para confirmar después. Las diferencias las revisa la administración, que decide si reenvía o cierra lo que faltó.' },
      { target: 'receipt-print', title: 'Constancia de recepción', description: 'Después de confirmar, imprimí la constancia de lo recibido para firmarla.', optional: true },
    ],
  },
]

// Recorrido de la pantalla actual para el rol, si hay uno.
export function screenTourFor(pathname: string, role: AppRole | null) {
  if (!role) return undefined
  return screenTours.find((tour) => tour.roles.includes(role) && tour.path.test(pathname))
}

// Clave de "ya visto" del recorrido automático: cambia con la versión.
export function screenTourSeenKey(tour: Pick<ScreenTour, 'id' | 'version'>) {
  return `solicitudes-insumos:tour:${tour.id}:v${tour.version}`
}

// Descripción del cartel (driver.js la inserta como HTML). Los textos son del código, no de usuarios.
export function stepHtml(step: Pick<TourStep, 'description' | 'items'>) {
  const list = step.items?.length ? `<ul class="tour-list">${step.items.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''
  return `<p>${step.description}</p>${list}`
}
