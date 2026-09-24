# Pendientes — UI perfil Farmacéutica

Estado al 2026-09-24, rama `feat/actualizacion-ui`.
Se resuelven en orden, uno por uno. Marcar cada ítem al cerrarlo e indicar la decisión tomada.

## 1. Bloqueantes para que lo implementado funcione

- [x] **1.1 Aplicar migración** `supabase/migrations/202609240001_request_item_quantities.sql`
  en el SQL Editor del proyecto de desarrollo. Agrega las columnas computadas
  `delivered_quantity` y `pending_quantity` en `request_items`. Sin ella, Inicio y el
  detalle de solicitud muestran error de carga.
- [x] **1.2 Probar con una cuenta farmacéutica real** contra Supabase. Prioridad:
  - Inicio: orden de "Productos pendientes de recibir" (`order=request(created_at).desc`, sin verificar).
  - Detalle: búsqueda y filtro Con/Sin pendiente.
  - Nueva solicitud: búsqueda en servidor, envío y paso 3.
  - Solicitudes: filtros por fecha y paginación.
- [x] **1.3 Validación completa** — typecheck, lint (0 errores), tests (21/21) y build OK.
- [x] **1.4 Commit** en `feat/ui-farmaceutica`, creada desde `develop` actualizado.

## 2. Detenidos por falta de datos o reglas

Requieren definir una regla de negocio y/o un cambio de esquema antes de implementarse.

- [x] **2.1 Estado de solicitud** — implementado, migración aplicada y probado.
  - Decisión: regla por cantidades (pendiente/entregado), calculada en la base; cuarto estado
    **Cerrada** (pendiente 0 y entregado 0, neutral); estado también por ítem.
  - Migración: `supabase/migrations/202609240002_request_status.sql`
    (`request_status`, `item_status`, `total_delivered_quantity`, `total_pending_quantity`).
  - UI: `StatusBadge` (shadcn Badge), indicadores en Inicio con enlace al listado filtrado,
    columna y filtro de estado (shadcn Select) en Solicitudes, estado en Detalle y por producto.
  - Docs: UI-SPEC §10, DESIGN-SYSTEM §4/§14/§27.6/§29, README paso 7.
- [x] **2.2 Número de solicitud** — implementado, migración aplicada y probado.
  - Decisión: secuencia global (`requests.request_number`, identity `generated always`),
    formato `#SOL-{n}`; existentes numeradas por fecha de creación.
  - Migración: `supabase/migrations/202609240003_request_number.sql`.
  - UI: columna N° solicitud (Inicio y Solicitudes), filtro por número en Solicitudes,
    título del detalle, número en el paso 3 y en "Productos pendientes de recibir".
  - Docs: UI-SPEC §7, README paso 8.
- [ ] **2.3 Último movimiento e historial** — **bloqueado por Fase 7 (auditoría)**.
  - Decisión: la fuente será `audit_events` (incluye cierres y anulaciones), no
    creación + entregas. Requiere: escritura de auditoría en las operaciones de negocio
    (Fase 7 de `plan-implementacion.md`) y una política RLS de lectura por centro.
  - Decisión: las entregas con ítems anulados se muestran marcadas como "Anulado".
- [x] **2.4 Observaciones** — implementado, migración aplicada y probado.
  - Decisión: opcional, hasta 500 caracteres, solo lectura tras enviar; visible solo en el detalle.
  - Migración: `supabase/migrations/202609240004_request_observations.sql` (columna
    `requests.observations` con check, y RPC `create_request_with_items` con tercer parámetro opcional).
  - UI: textarea con contador en el paso 2; card "Observaciones" en el detalle.
  - Docs: UI-SPEC §8/§9, README paso 9.
- [x] **2.5 Tipo de producto** — implementado, migración aplicada y probado.
  - Decisión: solo **Tipo** con tres valores: Medicamento, Descartable, Equipamiento.
    Rubro y stock de referencia se descartan.
  - Existentes: quedan como Descartable; el admin los corrige desde `/catalogos`.
    Sin default posterior: todo producto nuevo declara su tipo.
  - Migración: `supabase/migrations/202609240005_product_type.sql`.
  - UI: columna y filtro por tipo (servidor) en Nueva solicitud, columna en el detalle,
    selector de tipo en el formulario de productos de `/catalogos`.
  - Docs: UI-SPEC §8/§9.1, README paso 10.
- [x] **2.6 Catálogo** — implementado y probado (no requiere migración).
  - Decisión: `/catalogo` aparte, de solo lectura (admin sigue en `/catalogos`).
    Listado con búsqueda y filtro por tipo en servidor, paginado; detalle `/catalogo/{id}`
    con los datos del producto (nombre, tipo, presentación).
  - Sidebar: ítem Catálogo habilitado.
  - Refactor: paginación compartida (`ListFooter`, `listHref`, `PAGE_SIZE`) usada por
    Solicitudes y Catálogo.
  - Docs: UI-SPEC §9.2.

## 3. Decisiones abiertas

- [x] **3.1 Flujo de creación unificado** — implementado y probado con admin y farmacéutica.
  - Decisión: un solo flujo, `/solicitudes/nueva`. El admin elige el centro en el paso 2;
    `/nueva-solicitud` redirige. Se eliminaron `NewRequestForm` y `createRequest`.
- [x] **3.2 `src/lib/quantities.ts`** — borrado junto con su test. La regla vive en SQL (UI-SPEC §10).
- [x] **3.3 Saludo** — según la hora de Argentina (`src/lib/greeting.ts`, con tests). UI-SPEC §6 actualizado.
- [x] **3.4 Selector Con/Sin pendiente** — migrado a shadcn `ToggleGroup` (`@radix-ui/react-toggle-group`) y probado.
- [x] **3.5 Elementos del mockup no especificados en UI-SPEC** — decidido.
  - No se implementan por ahora: gráfico "Estado de solicitudes", card CTA en Inicio,
    Imprimir, "Solicitar los mismos productos".
  - Editar observación: descartado (2.4, observación de solo lectura).
  - Notificaciones: **bloqueado** junto con 2.3 (depende de Fase 7 y del flujo de entregas).

## 4. Menores

- [x] **4.1 Pantallas admin** — `/catalogos` usa `PageHeader` sin contenedor propio;
  `/nueva-solicitud` ahora redirige (3.1).
- [x] **4.2 Validación visual** — paso 2 del wizard y estado activo del sidebar revisados.
- [x] **4.3 `.env`** — línea con contraseña retirada.
