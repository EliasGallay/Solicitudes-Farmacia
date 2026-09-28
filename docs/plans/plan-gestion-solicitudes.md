# Plan — Gestión de solicitudes del lado del administrador

Estado al 2026-09-28. **Hecho** (código): fases 1 a 5, 6.1 y 7. **Pendiente**: aplicar las
migraciones `202610020001_request_management.sql`, `202610030001_request_actor_names.sql` y
`202610040001_delivery_receipts.sql` en el proyecto de desarrollo, correr
`supabase/tests/request_management_test.sql` y probar en la app; fases 6.2 y 6.3 (opcionales).
Cubre las fases 6 (entregas, cierres y anulaciones) y 7 (auditoría e historial) de
`plan-implementacion.md`, y las tareas pendientes de la fase 5 (listado por centro y estado,
transiciones de estado).
Objetivo: que el administrador reciba las solicitudes, las revise, entregue los productos
(total o parcialmente), cierre lo que no se va a entregar y corrija errores, con historial
completo y sin sobreentregas. Marcar cada ítem al cerrarlo e indicar la decisión tomada.

## 0. Situación de partida

- El solicitante crea la solicitud con `create_request_with_items` (RPC transaccional). Una
  solicitud es de un solo rubro y de un centro.
- El esquema ya tenía `deliveries`, `delivery_items` (con `status` `active` | `voided`),
  `request_items.closed_quantity` y `audit_events`, pero sin funciones ni pantallas que
  los usaran. `/entregas` y `/auditoria` eran páginas vacías.
- El estado **se calcula** de las cantidades (`202609240002_request_status.sql`):
  pendiente = solicitado − entregado (entregas activas) − cerrado.

  | Pendiente | Entregado | Estado |
  |---|---|---|
  | > 0 | = 0 | Pendiente |
  | > 0 | > 0 | Entrega parcial |
  | = 0 | > 0 | Completada |
  | = 0 | = 0 | Cerrada |

- Hay un único administrador global (`plan-rubros.md` 1.1).

## 1. Decisiones

- [x] **1.1 El estado sigue siendo calculado.** No hay un campo de estado editable: cambia solo
  al entregar, cerrar o anular, así nunca contradice las cantidades.
- [x] **1.2 Todo cambio pasa por una RPC.** Entregar, cerrar, anular y cancelar son funciones
  `security definer` que validan el rol, bloquean la solicitud (`for update`), revalidan
  saldos y escriben la auditoría en la misma transacción. La API no tiene `insert`/`update`
  directo sobre esas tablas.
- [x] **1.3 Nada se borra.** Una entrega errónea se anula (queda `voided` con motivo); un
  cierre se registra como un movimiento con motivo.
- [x] **1.4 Stock fuera de alcance.** El sistema no controla existencias.
- [x] **1.5 Sin estado manual "En preparación"** por ahora (un único admin). Queda como 6.3.
- [x] **1.6 Sin confirmación de recepción** por ahora. Queda como 6.2.
- [x] **1.7 Remito imprimible:** sí.
- [x] **1.8 El solicitante puede cancelar** su solicitud mientras no tenga entregas activas; se
  registra como cierre total con motivo `cancelada`.

## 2. Modelo de datos

Implementado en `supabase/migrations/202610020001_request_management.sql`:

- `deliveries`: `delivery_number` (identity, se muestra `#REM-n`), `note`, `voided_at`,
  `voided_by`, `void_reason` y el check `deliveries_void_consistent` (anulada ⇔ fecha, autor y
  motivo).
- `request_item_closures`: un movimiento por ítem cerrado (cantidad, motivo, detalle, autor,
  fecha). `request_items.closed_quantity` es el total acumulado y lo actualiza la misma RPC,
  así la regla de pendiente no cambió.

Notas:
- `reason = 'otro'` exige detalle (lo valida la RPC).
- Anular una entrega marca `voided` sus `delivery_items`: las cantidades vuelven a pendiente
  solas, porque `delivered_quantity` suma solo las activas.
- Un cierre no se anula en esta etapa; si se cerró de más, se corrige con una solicitud nueva.
  Revisar si hace falta al usar el sistema (se agregaría `request_item_closures.voided_*`).

## 3. Fases

### Fase 1 — Base: RPCs, cierres y auditoría

- [x] 1.1 Columnas nuevas de `deliveries` y tabla `request_item_closures`.
- [x] 1.2 `register_delivery(target_request_id, delivery_lines, delivery_note)`: solo admin;
  descarta cantidades 0, rechaza sobreentregas e ítems ajenos o repetidos, devuelve el id.
- [x] 1.3 `close_request_items(target_request_id, closure_items, closure_reason, closure_detail)`:
  solo admin. Un ítem sin `quantity` cierra todo su pendiente, calculado con la solicitud
  bloqueada.
- [x] 1.4 `void_delivery(target_delivery_id, reason)`: solo admin; rechaza una ya anulada.
- [x] 1.5 Auditoría con `write_audit` (interna, no expuesta). El alta se audita con un trigger
  sobre `requests` en lugar de reescribir `create_request_with_items`. Acciones:
  `request.created`, `request.cancelled`, `delivery.registered`, `delivery.voided`,
  `items.closed`; antes/después con las cantidades por ítem.
- [x] 1.6 RLS: `request_item_closures` con la regla de `deliveries`; `audit_events` solo
  lectura para el admin, y un trigger rechaza `update`/`delete` para cualquiera.
- [x] 1.7 Errores con código corto como mensaje (`sobreentrega`, `entrega-vacia`,
  `sin-pendiente`, `motivo-requerido`, `ya-anulada`, `con-entregas`, ...), traducidos en
  `src/lib/request-management.ts` → `src/lib/feedback.ts`.
- [x] 1.8 Tests unitarios en `tests/requests.test.ts` (números de remito, espera, resumen) y
  prueba de integración `supabase/tests/request_management_test.sql` (se corre en una
  transacción con rollback). La concurrencia la cubre el bloqueo de `lock_request`.

### Fase 2 — Detalle de la solicitud: gestión e historial

- [x] 2.1 Acciones en el encabezado de `/solicitudes/[id]` (solo admin y con pendiente):
  "Registrar entrega" y "Cerrar pendiente".
- [x] 2.2 `/solicitudes/[id]/entregar`: cantidades precargadas con el pendiente, atajos "Todo
  lo pendiente" / "Todo en 0", nota opcional, resumen y confirmación. Vuelve al detalle con
  el mensaje y el botón "Imprimir remito".
- [x] 2.3 `/solicitudes/[id]/cerrar`: productos pendientes marcados por defecto, motivo
  obligatorio y detalle (obligatorio si "Otro").
- [x] 2.4 Entregas dentro del **Historial** (no en una tarjeta aparte): en cada entrega, el
  admin tiene "Ver entrega", "Remito" y "Anular esta entrega" (motivo obligatorio).
- [x] 2.5 **Historial** armado desde `requests`, `deliveries` y `request_item_closures`. Los
  nombres de quienes actuaron (compañeros de centro y admin) salen de la RPC
  `request_actor_names` (`202610030001_request_actor_names.sql`): solo nombre, solo de los
  involucrados en esa solicitud y solo si quien consulta puede verla; el resto del perfil sigue
  protegido por RLS.
- [x] 2.6 Columna **Cerrado** en la tabla de productos (solo si algo se cerró).

### Fase 3 — Bandeja de solicitudes del admin

- [x] 3.1 "Por atender" (Pendiente + Entrega parcial) es la vista por defecto del admin;
  "Todos los estados" es `?estado=todos`.
- [x] 3.2 En "Por atender", orden de más antigua a más nueva.
- [x] 3.3 Columna **Espera** en días calendario de Argentina, resaltada desde
  `WAIT_WARNING_DAYS` (3 días, `src/lib/requests.ts`).
- [x] 3.4 Panel del admin: "Solicitudes por atender", "Esperando 3 días o más", "Entregas de
  hoy" y "Productos activos", cada uno con enlace al listado filtrado.

### Fase 4 — Sección Entregas

- [x] 4.1 `/entregas`: remitos con búsqueda por número de remito o `SOL-n`, filtros por
  centro, rubro, estado y fechas, con el color del centro.
- [x] 4.2 `/entregas/[id]`: productos del remito, nota, enlace a la solicitud y anulación.

### Fase 5 — Remito imprimible

- [x] 5.1 `/remitos/[id]` (fuera del shell para imprimir sin sidebar): remito y solicitud,
  centro, rubro, solicitante, productos, total, nota, quién entregó y firmas. Marca de agua
  "Anulado" si corresponde.
- [x] 5.2 "Imprimir remito" en el detalle de la entrega, en el historial de la solicitud y en el
  mensaje de éxito al registrarla.

### Fase 6 — Opcionales

- [x] 6.1 Cancelación por el solicitante (`cancel_request`) mientras no haya entregas activas.
- [x] 6.2 Confirmación de recepción por el centro: se hizo ítem por ítem (fase 8).
- [ ] 6.3 Estado manual "En preparación" si hay más de un admin.

### Fase 7 — Auditoría

- [x] 7.1 `/auditoria`: eventos con filtros por acción, usuario y fecha, enlace a la entidad y
  detalle con antes y después.

### Fase 8 — Confirmación de recepción por el centro

Decisiones: el centro informa lo que realmente llegó (cantidad + comentario obligatorio si llegó
menos); la diferencia la resuelve el admin; la solicitud queda **Recibida** cuando no hay
pendiente y todo lo entregado está confirmado sin diferencias abiertas; confirma cualquier
solicitante del centro y rubro.

- [x] 8.1 Migración `202610040001_delivery_receipts.sql`: tabla `delivery_item_receipts` (una
  por línea entregada), estados `completed` = "Entregada" (falta confirmar) y `received` =
  "Recibida", columnas computadas `receipt_unconfirmed_count` y `receipt_discrepancy_count`.
- [x] 8.2 RPC `confirm_receipt` (solicitante) y `resolve_receipt_difference` (admin):
  'reenviar' devuelve el faltante a pendiente; 'cerrar' lo cierra con motivo `no_recibido`.
  Una entrega con recepción confirmada ya no se anula.
- [x] 8.3 `/solicitudes/[id]/recibir`: línea por línea "Recibido conforme" / "Con diferencia"; lo no
  marcado queda para después. Aviso y botón en el detalle de la solicitud.
- [x] 8.4 Admin: tarjeta "Diferencias en la recepción" en el detalle; la bandeja "Por atender"
  incluye las solicitudes con diferencias; indicador en el panel; recepción por línea en
  `/entregas/[id]` y columna "Recepción" en `/entregas`.
- [x] 8.5 Historial y auditoría: recepciones, diferencias y resoluciones con autor.
- [x] 8.6 Solicitante: filtro y indicador "Por confirmar recepción".

## 4. Riesgos y notas

- La migración se aplica a mano en el proyecto remoto de desarrollo. Hasta aplicarla, las
  pantallas nuevas fallan (columnas y funciones inexistentes).
- Las solicitudes previas a la migración no tienen evento `request.created`; el historial
  toma la creación de `requests.created_at` y `created_by`.
- `src/components/section-page.tsx` quedó sin uso (era el placeholder de Entregas y
  Auditoría).
