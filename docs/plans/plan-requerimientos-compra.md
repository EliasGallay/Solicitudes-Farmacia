# Plan: requerimiento de compra

Cuando una solicitud hay que pedirla a compras, el admin anota el número de requerimiento que le da
el otro sistema y la solicitud pasa a un estado previo a la entrega. Por ahora solo eso; lo que siga
(p. ej. avisos, fecha estimada) se decide después.

## Decisiones

- [x] **Estado «En compras» (`purchase`), calculado como los demás.** No se guarda un estado:
  `request_status` devuelve `purchase` cuando hay pendiente, no se entregó nada y hay requerimiento
  registrado. Con la primera entrega pasa a «Entrega parcial» o «Entregada» como siempre; el número
  queda registrado en la solicitud.
- [x] **Número de requerimiento como texto libre, 1 a 30 caracteres, no único.** Varias solicitudes
  pueden ir en el mismo requerimiento (se pasan juntas a compras).
- [x] **Uno por solicitud, corregible.** Se registra o corrige mientras la solicitud tenga
  pendiente (también con entregas parciales, por si se pide a compras el resto). La corrección
  reemplaza el número; el anterior queda en la auditoría (`request.purchase_requirement`).
- [x] **Solo el admin lo registra** (RPC `set_purchase_requirement`, security definer). El
  solicitante lo ve en el detalle, el historial y la hoja de pedido.
- [x] **Búsqueda por número.** En el listado, un número solo («94020») busca por número de
  solicitud o de requerimiento y trae todas las solicitudes de ese requerimiento; `request_search_text`
  incluye además `req-{número}` («req 94020» busca solo por requerimiento).
- [x] **«En compras» cuenta como abierta**: está en la bandeja «Por atender» y en «Esperando N días».
- [x] **Sin notificación por ahora.** El solicitante ve el estado en sus listados y en el inicio
  (tarjeta «En compras»).
- [x] **El solicitante puede seguir cancelando** mientras no haya entregas, aunque esté en compras
  (la cancelación notifica al admin). Revisar si hace falta bloquearlo.

## Implementación

- [x] Migración `supabase/migrations/202610210001_purchase_requirements.sql`: columnas
  `purchase_requirement_number/_at/_by` en `requests`, `request_status` con `purchase`, búsqueda y
  RPC con auditoría.
- [x] Detalle de la solicitud: tarjeta para registrar/corregir (admin), número en el encabezado y
  evento en el historial.
- [x] Estado en `src/lib/request-status.ts`, badge, filtro de estado, inicio del solicitante y
  recorridos.
- [x] Hoja de pedido imprimible con el número.
- [ ] Registrar el mismo requerimiento en varias solicitudes a la vez desde el listado.
