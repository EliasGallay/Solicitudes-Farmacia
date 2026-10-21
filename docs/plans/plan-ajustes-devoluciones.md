# Ajustes por devoluciones de uso

Estado al 2026-10-19, rama `develop`. Lista de devoluciones de las pruebas con usuarios. Marcar cada
ítem al cerrarlo e indicar la decisión tomada.

## 1. Errores funcionales (prioridad alta)

- [ ] **1. Entregas duplicadas al resolver diferencias.** Sin reproducir.
  - Revisado: `resolve_receipt_difference` con 'reenviar' solo devuelve a pendiente el faltante
    (`delivered_quantity` pasa a contar lo recibido); `register_delivery` rechaza más que el pendiente
    (`sobreentrega`); el formulario de entrega precarga `pending_quantity`, no lo solicitado.
  - Falta: pasos exactos del caso reportado (o los datos de la solicitud) para reproducirlo.
- [x] **2. Tutorial: el cartel anterior quedaba visible.**
  - Decisión: un solo controlador (`TourController`, montado una vez en el shell) maneja el arranque
    automático y el recorrido guiado; los botones del sidebar y del menú mobile solo disparan. Al
    renderizar cada paso se quita cualquier otro cartel de driver.js. Antes de empezar se cierran el
    menú "Sistema y tutoriales" y el drawer mobile (un `<dialog>` modal queda por encima del overlay).
  - Cerrar el tour (Listo, cruz, Esc, clic afuera) termina el recorrido guiado; cambiar de paso del
    asistente lo reemplaza sin terminarlo.
- [x] **3. Volver al listado al cancelar una solicitud.**
  - Decisión: `cancelRequest` redirige a `/solicitudes` con el toast `solicitud-cancelada`.
- [x] **4. Columnas que se movían al filtrar por tipo.**
  - Decisión: tablas de productos con `table-fixed` y anchos fijos para Tipo, Presentación, Cantidad
    y Acciones (asistente de nueva solicitud, catálogo y catálogos del admin); los textos largos parten
    línea en lugar de ensanchar la columna.

## 2. Solicitudes y selección de productos

- [x] **5. Modificar cantidades en «Revisar y confirmar».**
  - Decisión: el mismo stepper (−, cantidad, +) que en la selección. En la revisión, restar no baja
    de 1: para quitar un producto está el botón Quitar.
- [x] **6. Contador ambiguo de productos seleccionados.**
  - Decisión: se eliminó; el botón flotante "Siguiente" queda solo.
- [x] **7. Alineación de tablas.**
  - Criterio: textos (producto, tipo, presentación, estado) a la izquierda; cantidades y conteos a la
    derecha con `tabular-nums`; acciones a la derecha. Corregida la columna Productos de Tipos de
    producto; el resto ya lo cumplía.

## 3. Recepción y confirmación de entregas

- [x] **8. Estados de recepción.**
  - Decisión: «Recibido conforme» = éxito (verde, check); «Con diferencia» = advertencia (ámbar,
    alerta), también en badges de listados y remitos (antes era rojo en unos lugares y ámbar en otros).
    Las opciones muestran su color e ícono antes de elegirlas; elegida, fondo suave + borde del color
    (antes texto blanco sobre el color, ilegible en oscuro). Cada línea marcada lleva borde izquierdo
    del color. "Marcar todo como recibido conforme" ya no pisa las diferencias cargadas.
- [x] **9. Consistencia entre detalle y confirmación.**
  - Decisión: la confirmación usa el mismo encabezado (título + estado) y una card con título como
    "Productos" del detalle; los remitos se agrupan con el estilo de encabezado de tabla. Siguen siendo
    pantallas separadas.
- [x] **10. Informar entregas incorrectas.**
  - Decisión: tercera opción «Producto equivocado» al confirmar cada línea (rojo, ícono de paquete
    tachado). Se registra como diferencia con recibido 0 y detalle obligatorio («¿Qué llegó en su
    lugar?»); el admin la resuelve igual: volver a pendiente (enviar el correcto) o cerrar.
  - Migración: `supabase/migrations/202610190001_wrong_product_receipts.sql`
    (`delivery_item_receipts.wrong_product`, check «equivocado ⇒ recibido 0», `confirm_receipt` con la
    misma firma). Estados, contadores y notificaciones no cambian: ya la cuentan como diferencia.
  - UI: formulario de recepción, diferencias abiertas e historial del detalle, detalle de entrega y
    constancia de recepción. El texto de la notificación de diferencia ahora cubre ambos casos.

## 4. Navegación y notificaciones

- [x] **11. Acceso a confirmaciones desde el sidebar.**
  - Decisión: ítem «Por confirmar» para el solicitante, con la cantidad de solicitudes con entregas
    sin confirmar, que abre `/solicitudes?estado=por_confirmar`.
- [x] **12. Organización del sidebar.**
  - Decisión: en desktop la campana pasa al sidebar, encima del perfil, como fila «Notificaciones»
    con el contador a la derecha (mismo `NotificationBell`, tono `nav`; el panel se abre a la derecha
    del sidebar). El botón «Cómo funciona esta pantalla» va en la misma fila. Se eliminó la barra
    superior del contenido: cada página empieza con su encabezado. En mobile no cambia (campana y
    ayuda en la barra superior).
  - Hecho: desplegable «Sistema y tutoriales» reorganizado en grupos con título (Apariencia, Ayuda),
    separadores, ítems compactos del mismo alto, íconos en lugar de «?»/«→» y «Cerrar sesión» al final
    y aparte. El interruptor de tema tiene etiqueta fija («Modo oscuro»); el estado lo indica el switch.
- [x] **13. Contador de notificaciones sin leer.**
  - Decisión: junto al título del panel, «· N sin leer» como texto (no otro badge), con el mismo estado
    que la campana: siempre coinciden.

## 5. Diseño visual y accesibilidad

- [x] **14. Contraste de «Cerrada».**
  - Decisión: badge neutral con borde `border-strong` y texto `foreground`.
- [x] **15. Animaciones en modo claro.**
  - Decisión: tokens `surface-hover` y `border-hover` para hover/foco (en claro más marcados que
    `primary-50`/`primary-100`; en oscuro, los mismos valores de antes). Skeleton sobre `border`,
    anillo del paso activo `primary-400/30`, círculo animado del login sobre `surface-hover`, hover de
    la campana y de las notificaciones sobre `surface-hover`. Documentado en DESIGN-SYSTEM.md.

## 6. Usabilidad general

- [x] **16. Acceso a operaciones frecuentes.**
  - Decisión: cubierto con el ítem «Por confirmar» del sidebar (11), además de los indicadores de
    Inicio y del aviso «Falta confirmar la recepción» en el detalle.

- [x] **17. Entregar más de lo pedido.** (ej. pidieron 50 de diazepam y se mandan 100)
  - Decisión: la entrega ya no se limita al pendiente; el formulario no tiene máximo y avisa en ámbar
    cuántas unidades van por encima. Los cierres siguen limitados al pendiente (`sobreentrega`).
  - Migración: `supabase/migrations/202610210004_over_delivery.sql`. `pending_quantity` nunca baja
    de 0 (con sobreentrega el ítem queda completo); `resolve_request_items` suma `allow_excess`
    (solo `register_delivery` lo usa); `resolve_receipt_difference` con 'cerrar' cierra como mucho
    lo que volvió a pendiente, así `closed_quantity` no supera lo solicitado.

## 7. Tutoriales por pantalla y por tarea

Objetivo: que cada pantalla explique qué hace cada cosa (qué es, para qué sirve, qué pasa al usarlo).

- [x] **7.1 Registro de recorridos y pantallas del solicitante.**
  - Decisión: recorridos como datos en `src/lib/tours.ts` (pantalla, rol, versión, pasos que señalan
    elementos `data-tour`); los muestra `TourController`. Pantallas: Inicio, Solicitudes, Detalle y
    Confirmar recepción.
  - Arranque automático una sola vez por pantalla y versión, cuando la pantalla terminó de cargar y no
    hay otro tour en curso (el tour general de la primera visita va antes). En el cartel automático,
    «No mostrar más estos recorridos» apaga los automáticos; el botón de ayuda sigue disponible.
  - Botón «Cómo funciona esta pantalla» (ícono de ayuda) junto a la campana, solo donde hay recorrido.
  - Pasos opcionales: si el elemento no está (según datos o ancho de pantalla), se saltean.
  - Carteles de driver.js con los colores del Design System (también en modo oscuro).
  - `tests/tours.test.ts` verifica que cada `data-tour` de los recorridos exista en el código.
- [ ] **7.2 Explicación de cada estado** al pasar el mouse por los badges.
- [ ] **7.3 Recorridos del admin**: bandeja, registrar entrega, diferencias, entregas.
- [ ] **7.4 Página Ayuda** en «Sistema y tutoriales»: guías por rol y glosario.
- [ ] **7.5 Prueba con 2 o 3 usuarios** de los centros y ajuste de textos.

## Preguntas abiertas

- 1: pasos para reproducir la entrega duplicada.
