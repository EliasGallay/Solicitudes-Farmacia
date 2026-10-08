# Plan — Notificaciones

Estado al 2026-10-08. **Hecho** (código): fases 1 y 2. **Pendiente**: aplicar
`202610080001_notifications.sql` en el proyecto de desarrollo, correr
`supabase/tests/notifications_test.sql` y probar en la app con un solicitante y el admin.
Objetivo: que cada uno se entere de las novedades de las solicitudes que le tocan sin tener que
revisar los listados. Marcar cada ítem al cerrarlo e indicar la decisión tomada.

## 1. Decisiones

- [x] **1.1 Solo dentro de la app.** Campana con contador en el shell y pantalla
  `/notificaciones`. Sin email por ahora: no suma proveedor ni claves. Si se agrega, se manda desde
  la misma tabla (por ejemplo, un resumen diario de no leídas).
- [x] **1.2 Se generan desde la auditoría.** Un trigger `after insert` sobre `audit_events`
  (`notify_from_audit`) crea las notificaciones. Toda operación de negocio ya escribe su evento en
  su transacción, así que no se reescriben las RPCs y una operación fallida no deja notificación.
- [x] **1.3 Destinatarios: toda operación se notifica al admin y al centro** (decisión del
  2026-10-08; la primera versión solo avisaba a quien tenía que actuar).

  | Evento (auditoría) | Notificación |
  |---|---|
  | `request.created` | Solicitud nueva |
  | `request.cancelled` | Solicitud cancelada |
  | `delivery.registered` | Entrega registrada (al centro lo lleva a confirmar la recepción) |
  | `delivery.voided` | Entrega anulada |
  | `items.closed` | Pendiente cerrado |
  | `delivery.received` sin diferencias | Recepción confirmada |
  | `delivery.received` con alguna línea con menos de lo entregado | Diferencia en la recepción |
  | `receipt.resolved` | Diferencia resuelta |

  Reciben los admins activos y los solicitantes activos del centro con el rubro de la solicitud.
  Quien hizo la operación nunca se notifica. Cada texto tiene una versión para el admin (nombra
  el centro) y otra para el centro ("de tu centro"). Fuera de alcance: acciones que no son sobre
  una solicitud (usuarios, catálogo), que no pasan por la auditoría.
- [x] **1.4 El texto se arma en la app** (`src/lib/notifications.ts`) a partir del tipo y los datos
  de la solicitud, no se guarda: así respeta RLS y los cambios de redacción aplican a las viejas.
- [x] **1.5 Contador sin Realtime.** El shell persiste entre navegaciones: se reconsulta al
  cambiar de página, al volver a la pestaña y cada 60 s (`NOTIFICATIONS_POLL_MS`) con un GET a
  `/api/notificaciones/no-leidas` (no server action, para no encolarse con los formularios).
- [x] **1.6 Nada se borra al leer.** `read_at` se completa con la RPC `mark_notifications_read`;
  la API no tiene `update` directo.

## 2. Fases

### Fase 1 — Base de datos

- [x] 1.1 Migración `202610080001_notifications.sql`: tabla `notifications`, RLS (cada uno ve las
  suyas), trigger `notify_from_audit` y RPC `mark_notifications_read(ids)` (sin ids marca todas).
- [x] 1.2 Prueba de integración `supabase/tests/notifications_test.sql` (rollback).

### Fase 2 — App

- [x] 2.1 ~~Ítem "Notificaciones" en el sidebar~~: se quitó; el acceso es solo la campana (2.4 y 2.5).
- [x] 2.2 `/notificaciones`: listado paginado, filtro "Todas" / "No leídas", "Marcar todas como
  leídas"; al abrir una se marca como leída y lleva a la solicitud.
- [x] 2.3 Tests unitarios en `tests/notifications.test.ts`.
- [x] 2.4 Campana arriba a la derecha (barra superior en desktop, barra del menú en mobile):
  contador que late mientras haya sin leer y sacudida cuando sube el contador durante la sesión
  (no al cargar). Animaciones con `motion-safe:` (`--animate-bell-ring`, `--animate-badge-ping`).
- [x] 2.5 Panel desplegable de la campana: últimas `RECENT_NOTIFICATIONS_LIMIT` (8) con tiempo
  relativo, "Marcar todas como leídas" sin salir de la página y "Ver todas" al pie hacia
  `/notificaciones`. Datos de `/api/notificaciones/recientes`, que también actualiza el contador.
  El armado de cada ítem (`src/lib/notification-items.ts`) es el mismo que usa `/notificaciones`.

### Fase 3 — Opcionales

- [ ] 3.1 Paso de notificaciones en el tutorial (`src/components/product-tour.tsx`; la campana ya
  tiene `data-tour="notifications-bell"`).
- [ ] 3.2 Email (resumen de no leídas) si el uso lo pide.
- [ ] 3.3 Limpieza de notificaciones leídas antiguas si la tabla crece.
