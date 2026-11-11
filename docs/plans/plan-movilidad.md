# Plan de implementación: módulo Movilidad (flota de vehículos)

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes
> (`- [ ]`) para el seguimiento.

**Objetivo:** registrar los vehículos de Salud, su historial de mantenimientos y reparaciones, y las
solicitudes de servicio de Movilidad con requerimiento de compra, cierre y auditoría.

**Arquitectura:** tablas propias (`vehicles`, `vehicle_requests`, `vehicle_records`), separadas de las
solicitudes de insumos porque esas giran alrededor de ítems y cantidades. El acceso se da con un rubro
nuevo `fleet` («Movilidad»), marcado con `areas.kind = 'fleet'` para que no aparezca en las pantallas de
insumos. Toda escritura de negocio pasa por RPCs `security definer` que validan rol, bloquean filas y
escriben `audit_events`; las notificaciones salen del trigger existente sobre la auditoría.

**Stack:** Next.js 15 App Router + React 19, Supabase (Postgres, RLS, RPC), Zod 4, React Hook Form,
Vitest.

**Spec:** `docs/plans/diseno-movilidad.md`.

## Restricciones globales

- Textos de UI, comentarios, docs y commits en castellano rioplatense.
- Nunca commitear sin permiso explícito del usuario; sin atribución de IA en commits ni PRs.
- Las migraciones se aplican a mano en el SQL Editor del proyecto de desarrollo, en orden; no correr
  nada contra Supabase remoto sin autorización.
- Guard en **cada** página y server action (`requireRole('admin')`, `requireArea(FLEET_AREA)`,
  `requireFleetAccess()`); la base repite la regla con RLS y RPCs.
- Toda función `security definer` interna: `revoke execute ... from public, anon, authenticated`. Las
  expuestas: `revoke ... from public, anon` + `grant ... to authenticated`.
- Feedback solo por códigos ASCII en la URL (`withFeedback`); mensajes en `src/lib/feedback.ts`. Errores
  de RPC: códigos cortos traducidos en `rpcErrorCodes` (`src/lib/request-management.ts`).
- Límites de Zod iguales a los `check` de la base: nombre/marca/modelo 80, identificador 30, dominio 6
  a 7, descripción/qué se hizo 1000, taller 120, motivo 500 (`NOTE_MAX_LENGTH`), requerimiento 30
  (`PURCHASE_REQUIREMENT_MAX_LENGTH`).
- Año de vehículo: entre 1950 y el año actual + 1. Fecha de trabajo: no posterior a hoy en Argentina
  (`argentinaDate` de `src/lib/requests.ts`).
- Colores solo por tokens semánticos; reutilizar `PageHeader`, `FilterBar`, `EmptyState`, `ErrorState`,
  `StatusBadge`, `MobileList`, `Pagination`, `ConfirmSubmit`, primitivas de `src/components/ui`.
- Nada se borra: vehículos se desactivan, registros se anulan con motivo, solicitudes se cancelan con
  motivo.

## Foco de revisión

1. **Dominio escrito de cualquier forma** (`ab 123-cd`, `abc-123`) se guarda normalizado (`AB123CD`,
   `ABC123`) y un dominio repetido da «Ya existe un vehículo con ese dominio», no un error genérico.
   → Tests en la Tarea 2 (`normalizePlate`) y verificación SQL en la Tarea 1 (índice único).
2. **Completar o cancelar una solicitud ya cerrada** (doble clic, dos personas a la vez) se rechaza con
   «La solicitud ya está cerrada» y no crea un segundo registro. → Verificación SQL en la Tarea 1.
3. **Anular el registro que cerró una solicitud** la devuelve a «En compras» si tenía requerimiento o a
   «Pendiente» si no. → Verificación SQL en la Tarea 1.
4. **Usuario de farmacia que entra a `/movilidad` por URL** vuelve al inicio con «sin-rubro», y la API
   no le devuelve filas; **usuario solo de Movilidad** no ve Solicitudes, Por confirmar, Nueva solicitud
   ni Catálogo de insumos. → Tests en la Tarea 3 (`splitAreas`, `requesterNavigation`) y verificación
   SQL en la Tarea 1.
5. **Fecha de trabajo cerca de medianoche:** a las 22:00 de Argentina «hoy» es válido y «mañana» no,
   aunque en UTC ya sea el día siguiente. → Test en la Tarea 2 (`isWorkDateAllowed`).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/202610280001_fleet.sql` | Rubro `fleet`, `areas.kind`, tablas, estado y búsqueda calculados, RLS, RPCs, auditoría |
| `supabase/migrations/202610280002_fleet_notifications.sql` | Notificaciones de solicitudes de vehículos |
| `src/lib/fleet.ts` | Constantes, normalización, formato de número, estados, esquemas Zod (cliente y servidor) |
| `src/lib/session.ts` (mod.) | `fleetAccess`, `areas` solo de insumos, `requireFleetAccess()` |
| `src/lib/areas.ts` (mod.) | `getAreas` filtra `kind = 'supplies'` |
| `src/app/fleet-actions.ts` | Server actions del módulo |
| `src/app/(app)/movilidad/**` | Pantallas |
| `src/components/fleet/*` | Formularios, línea de tiempo, filtros, badge de estado |
| `src/components/sidebar.tsx`, `src/app/(app)/page.tsx` (mod.) | Menú e inicio según acceso |
| `src/lib/notification-items.ts`, `src/lib/notifications.ts`, `src/lib/audit.ts` (mod.) | Textos y enlaces |
| `tests/fleet.test.ts` | Tests de `src/lib/fleet.ts` y de navegación |

---

### Tarea 1: Migración de datos y reglas en la base

**Archivos:**
- Crear: `supabase/migrations/202610280001_fleet.sql`
- Crear: `supabase/checks/movilidad.sql` (consultas de verificación, solo lectura salvo dentro de
  `begin; ... rollback;`)

**Interfaces:**
- Produce (tablas):
  - `areas.kind text not null default 'supplies' check (kind in ('supplies','fleet'))`; fila
    `('fleet', 'Movilidad', kind 'fleet')`.
  - `vehicles(id uuid pk, name, brand, model text, year int, plate text unique, internal_code text
    null, active bool default true, created_at, created_by)`; índice único
    `lower(btrim(internal_code))` donde no es null; checks de largo y `plate ~ '^[A-Z0-9]{6,7}$'`.
  - `vehicle_requests(id, request_number bigint identity, vehicle_id fk, description text, created_at,
    created_by, purchase_requirement_number/_at/_by` (mismo check de consistencia que `requests`),
    `cancelled_at, cancelled_by, cancel_reason` (todo null o todo presente)`)`.
  - `vehicle_records(id, vehicle_id fk, kind text check in ('maintenance','repair'), description,
    performed_on date, workshop text, vehicle_request_id uuid null fk, created_at, created_by,
    voided_at, voided_by, void_reason)`; índice único parcial `(vehicle_request_id) where
    vehicle_request_id is not null and voided_at is null` (una solicitud, un cierre activo).
  - Columnas calculadas (funciones `stable security invoker`, como `request_status`):
    `vehicle_requests.status` → `'pending' | 'purchase' | 'completed' | 'cancelled'` (cancelada gana;
    luego completada si hay registro activo vinculado; luego `purchase` si hay requerimiento);
    `vehicles.vehicle_search_text` → `normalize_search(name || brand || model || plate ||
    internal_code)`; `vehicle_requests.vehicle_request_search_text` → `'srv-' || número || ' ' ||
    coalesce('req-' || requerimiento) || descripción || texto del vehículo`.
  - RPCs expuestas (todas `security definer`, `set search_path = public`, `raise exception '<código>'`):
    - `create_vehicle_request(target_vehicle_id uuid, request_description text) returns uuid`
    - `set_vehicle_purchase_requirement(target_request_id uuid, requirement_number text) returns void`
      (solo admin)
    - `complete_vehicle_request(target_request_id uuid, record_description text, record_performed_on
      date, record_workshop text) returns uuid` (id del registro, kind `repair`)
    - `cancel_vehicle_request(target_request_id uuid, reason text) returns void`
    - `add_vehicle_record(target_vehicle_id uuid, record_kind text, record_description text,
      record_performed_on date, record_workshop text) returns uuid`
    - `void_vehicle_record(target_record_id uuid, reason text) returns void` (solo admin)
  - Códigos de error: `sin-permiso`, `vehiculo-invalido`, `vehiculo-inactivo`, `descripcion-invalida`,
    `fecha-invalida`, `taller-invalido`, `solicitud-invalida`, `solicitud-cerrada`,
    `requerimiento-invalido`, `motivo-requerido`, `registro-invalido`, `ya-anulado`.
  - Acciones de auditoría: `vehicle.created`, `vehicle.updated`, `vehicle.deactivated`,
    `vehicle.activated` (trigger sobre `vehicles`), `vehicle_record.created`, `vehicle_record.voided`
    (`entity_type 'vehicle'`, `entity_id` = vehículo), `vehicle_request.created`,
    `vehicle_request.purchase_requirement`, `vehicle_request.completed`, `vehicle_request.cancelled`
    (`entity_type 'vehicle_request'`).

- [x] **Paso 1: Escribir `supabase/checks/movilidad.sql`** con un bloque `begin; ... rollback;` por
  caso, usando `set local role authenticated` y `set local request.jwt.claims` con el `sub` de un
  admin, de un usuario con rubro `fleet` y de uno solo con `pharmacy`. Cada bloque termina con un
  `select` cuyo resultado esperado está en un comentario:
  - insertar dos vehículos con dominio `AB123CD` → el segundo falla con `23505`;
  - usuario `pharmacy`: `select count(*) from vehicles` → `0`; `create_vehicle_request` → `sin-permiso`;
  - usuario `fleet`: `insert into vehicles` → violación de RLS; `create_vehicle_request` → ok, `status`
    `pending`;
  - admin: `set_vehicle_purchase_requirement` → `status = 'purchase'`;
  - `complete_vehicle_request` → `status = 'completed'` y un `vehicle_records` `repair` vinculado;
    llamarla de nuevo → `solicitud-cerrada`; `cancel_vehicle_request` → `solicitud-cerrada`;
  - `void_vehicle_record` sobre ese registro → `status = 'purchase'`; sin requerimiento → `pending`;
  - `add_vehicle_record` con `performed_on = current_date + 1` → `fecha-invalida`;
  - `update vehicles set active = false` con solicitud abierta → `vehiculo-con-solicitudes`;
  - permisos: `has_function_privilege('authenticated', '<cada helper interno>', 'execute')` → `false`
    para todos los helpers; `true` para las seis RPCs expuestas; `false` para `anon` en todas.
- [x] **Paso 2: Escribir la migración** siguiendo el estilo de
  `202610210001_purchase_requirements.sql` (secciones numeradas, comentarios en castellano):
  - `areas.kind` + rubro `fleet`; `has_area()` sirve sin cambios.
  - Tablas con RLS; `grant select` a `authenticated` en las tres; `grant insert, update` solo en
    `vehicles` con políticas admin; el resto se escribe solo por RPC.
  - Políticas de lectura: `current_app_role() = 'admin' or has_area('fleet')`.
  - Trigger `before update` en `vehicles`: normaliza `plate` (`upper`, sin espacios ni guiones) y
    rechaza desactivar con solicitudes abiertas (`raise exception 'vehiculo-con-solicitudes'`); trigger
    `after insert or update` que escribe la auditoría del vehículo. El mismo trigger de normalización
    corre en `before insert`.
  - Permisos de las RPCs: admin o `has_area('fleet')` salvo las marcadas «solo admin». Toda RPC que
    toca una solicitud la bloquea con `select ... for update`; las que crean registros exigen vehículo
    activo (`vehiculo-inactivo`) y `performed_on <= (now() at time zone 'America/Argentina/Buenos_Aires')::date`.
  - Al final: `revoke` según restricciones globales y `notify pgrst, 'reload schema';`.
- [ ] **Paso 3: Pedir al usuario que aplique la migración y corra `supabase/checks/movilidad.sql`**
  en el proyecto de desarrollo. Esperado: cada bloque da el resultado del comentario.
- [x] **Paso 4: Actualizar `README.md`** con los pasos nuevos de migración (después de
  `202610270001_health_center_admin.sql`, antes del seed de rubros).
- [ ] **Paso 5: Commit** (con permiso del usuario): `feat: tablas y reglas del módulo Movilidad`.

### Tarea 2: Dominio del módulo en TypeScript

**Archivos:**
- Crear: `src/lib/fleet.ts`
- Crear: `tests/fleet.test.ts`

**Interfaces:**
- Produce:
  - `FLEET_AREA = 'fleet'`; límites `VEHICLE_TEXT_MAX = 80`, `INTERNAL_CODE_MAX = 30`,
    `FLEET_DESCRIPTION_MAX = 1000`, `WORKSHOP_MAX = 120`, `VEHICLE_YEAR_MIN = 1950`.
  - `normalizePlate(value: string): string` y `isValidPlate(value: string): boolean` (`ABC123` o
    `AB123CD` después de normalizar).
  - `vehicleLabel(v: { name: string; plate: string; internal_code: string | null }): string` →
    `'Blanco 01 · Ambulancia (AB123CD)'` o `'Ambulancia (AB123CD)'`.
  - `formatVehicleRequestNumber(n: number): string` → `'#SRV-15'`;
    `parseVehicleRequestNumber(value: string): number | null` (mismo criterio que `parseRequestNumber`).
  - `vehicleRequestStatuses = ['pending','purchase','completed','cancelled'] as const`,
    `VehicleRequestStatus`, `vehicleRequestStatusLabels` (`Pendiente`, `En compras`, `Completada`,
    `Cancelada`), `openVehicleRequestStatuses = ['pending','purchase']`.
  - `vehicleRecordKinds = ['maintenance','repair'] as const`, `vehicleRecordKindLabels`
    (`Mantenimiento`, `Reparación`).
  - `isWorkDateAllowed(date: string, now?: number): boolean` (usa `argentinaDate`).
  - Esquemas Zod: `vehicleSchema`, `vehicleRecordSchema`, `vehicleRequestSchema`,
    `completeVehicleRequestSchema`.

- [x] **Paso 1: Escribir los tests que fallan** en `tests/fleet.test.ts`:

```ts
describe('dominio', () => {
  it.each([['ab 123-cd', 'AB123CD'], [' abc-123 ', 'ABC123']])('normaliza %s', (input, expected) => expect(normalizePlate(input)).toBe(expected))
  it.each(['ABC123', 'AB123CD', 'ab 123 cd'])('acepta %s', (value) => expect(isValidPlate(value)).toBe(true))
  it.each(['', 'AB12', 'ABCD1234', 'AB-12'])('rechaza %s', (value) => expect(isValidPlate(value)).toBe(false))
})

describe('vehículo', () => {
  it('antepone el identificador interno', () => expect(vehicleLabel({ name: 'Ambulancia', plate: 'AB123CD', internal_code: 'Blanco 01' })).toBe('Blanco 01 · Ambulancia (AB123CD)'))
  it('sin identificador', () => expect(vehicleLabel({ name: 'Ambulancia', plate: 'AB123CD', internal_code: null })).toBe('Ambulancia (AB123CD)'))
  it('rechaza año fuera de rango', () => expect(vehicleSchema.safeParse({ name: 'A', brand: 'B', model: 'C', year: 1949, plate: 'ABC123', internal_code: '' }).success).toBe(false))
})

describe('número de solicitud de servicio', () => {
  it('formatea con prefijo SRV', () => expect(formatVehicleRequestNumber(15)).toBe('#SRV-15'))
  it.each(['15', '#SRV-15', 'srv15', ' #srv-15 '])('interpreta %s', (value) => expect(parseVehicleRequestNumber(value)).toBe(15))
  it.each(['', 'SOL-15', 'SRV-', '1.5'])('rechaza %s', (value) => expect(parseVehicleRequestNumber(value)).toBeNull())
})

describe('fecha de trabajo', () => {
  const at2200 = new Date('2026-10-29T01:00:00Z').getTime() // 22:00 del 28/10 en Argentina
  it('hoy en Argentina es válido', () => expect(isWorkDateAllowed('2026-10-28', at2200)).toBe(true))
  it('mañana no', () => expect(isWorkDateAllowed('2026-10-29', at2200)).toBe(false))
})
```

- [x] **Paso 2: Correr** `npx vitest run tests/fleet.test.ts`. Esperado: FALLA (no existe el módulo).
- [x] **Paso 3: Implementar `src/lib/fleet.ts`** con las firmas de arriba. Los esquemas usan los
  límites de las restricciones globales; `internal_code` vacío se transforma en `null`; `plate` pasa
  por `normalizePlate` y se valida con `isValidPlate`.
- [x] **Paso 4: Correr** `npx vitest run tests/fleet.test.ts` y `npm run typecheck`. Esperado: PASA.
- [ ] **Paso 5: Commit** (con permiso): `feat: reglas y formatos del módulo Movilidad`.

### Tarea 3: Acceso por rubro, menú e inicio

**Archivos:**
- Modificar: `src/lib/session.ts`, `src/lib/areas.ts`, `src/components/sidebar.tsx`,
  `src/components/app-shell.tsx`, `src/app/(app)/page.tsx`
- Test: `tests/fleet.test.ts`

**Interfaces:**
- Consume: `FLEET_AREA` (Tarea 2).
- Produce:
  - `splitAreas(rows: { area: string; kind: string }[]): { areas: AreaKey[]; fleetAccess: boolean }`
    en `src/lib/session.ts` (exportada para test).
  - La sesión suma `fleetAccess: boolean` (admin: `true`) y `areas` deja de incluir `fleet`.
  - `requireFleetAccess(): Promise<Session>`: como `requireArea`, redirige a
    `withFeedback('/', 'error', 'sin-rubro')`.
  - `requesterNavigation(opts: { supplies: boolean; fleet: boolean }): NavItem[]` exportada desde
    `src/components/sidebar.tsx` (o un `src/lib/navigation.ts` si importar el componente cliente en
    el test molesta).
  - `getAreas` devuelve solo `kind = 'supplies'`.

- [x] **Paso 1: Tests que fallan:**

```ts
describe('rubros de la sesión', () => {
  it('separa Movilidad de los rubros de insumos', () => expect(splitAreas([{ area: 'pharmacy', kind: 'supplies' }, { area: 'fleet', kind: 'fleet' }])).toEqual({ areas: ['pharmacy'], fleetAccess: true }))
  it('sin Movilidad', () => expect(splitAreas([{ area: 'pharmacy', kind: 'supplies' }])).toEqual({ areas: ['pharmacy'], fleetAccess: false }))
})

describe('menú del solicitante', () => {
  const hrefs = (opts: { supplies: boolean; fleet: boolean }) => requesterNavigation(opts).map((item) => item.href)
  it('solo Movilidad no ve insumos', () => expect(hrefs({ supplies: false, fleet: true })).toEqual(['/', '/movilidad']))
  it('solo insumos no ve Movilidad', () => expect(hrefs({ supplies: true, fleet: false })).not.toContain('/movilidad'))
  it('ambos ven todo', () => expect(hrefs({ supplies: true, fleet: true })).toContain('/movilidad'))
})
```

- [x] **Paso 2: Correr** `npx vitest run tests/fleet.test.ts`. Esperado: FALLA.
- [x] **Paso 3: Implementar.** La consulta de `getSession` pasa a `profile_areas(area, area_info:areas(kind))`.
  El admin recibe un ítem «Movilidad» (`/movilidad`, ícono `Car` de lucide) entre Entregas y Catálogos.
  En `src/app/(app)/page.tsx`, un solicitante sin rubros de insumos y con `fleetAccess` hace
  `redirect('/movilidad')`. Las pantallas de insumos que ya llaman a `requireArea` no cambian.
- [x] **Paso 4: Correr** `npm test` y `npm run typecheck`. Esperado: PASA.
- [ ] **Paso 5: Verificar en la app** (`npm run dev`) con un usuario de farmacia: el menú y los
  selectores de rubro (nueva solicitud, catálogo, filtros) no muestran «Movilidad».
- [ ] **Paso 6: Commit** (con permiso): `feat: acceso al módulo Movilidad por rubro`.

### Tarea 4: Server actions y mensajes

**Archivos:**
- Crear: `src/app/fleet-actions.ts`
- Modificar: `src/lib/feedback.ts`, `src/lib/request-management.ts` (`rpcErrorCodes`)
- Test: `tests/feedback.test.ts`

**Interfaces:**
- Consume: esquemas de la Tarea 2, `requireFleetAccess` de la Tarea 3, RPCs de la Tarea 1.
- Produce (todas `'use server'`, redirigen con `withFeedback`):
  - `createVehicle(values: VehicleValues): Promise<{ error: string }>` y
    `updateVehicle(id: string, values: VehicleValues): Promise<{ error: string }>` (admin; insert/update
    directo; `23505` → `vehiculo-duplicado`).
  - `toggleVehicle(formData: FormData)` (admin; `vehiculo-con-solicitudes` si corresponde).
  - `addVehicleRecord(vehicleId: string, values: VehicleRecordValues): Promise<{ error: string }>`.
  - `voidVehicleRecord(formData: FormData)` (admin; `id`, `reason`).
  - `createVehicleRequest(values: VehicleRequestValues): Promise<{ error: string }>` → redirige al
    detalle con `success=solicitud-servicio-creada`.
  - `setVehiclePurchaseRequirement(formData: FormData)` (admin).
  - `completeVehicleRequest(requestId: string, values: CompleteVehicleRequestValues): Promise<{ error: string }>`.
  - `cancelVehicleRequest(formData: FormData)`.
  - Códigos nuevos en `feedback.ts`: `vehiculo-creado`, `vehiculo-actualizado`, `vehiculo-activado`,
    `vehiculo-desactivado`, `vehiculo-duplicado`, `vehiculo-invalido`, `vehiculo-inactivo`,
    `vehiculo-con-solicitudes`, `registro-creado`, `registro-anulado`, `registro-ya-anulado`,
    `solicitud-servicio-creada`, `solicitud-servicio-completada`, `solicitud-servicio-cancelada`,
    `solicitud-servicio-cerrada`, `fecha-trabajo-invalida`, `movilidad-error`. Cada código de RPC de
    la Tarea 1 se mapea en `rpcErrorCodes` (`ya-anulado` → `registro-ya-anulado`,
    `solicitud-cerrada` → `solicitud-servicio-cerrada`, `fecha-invalida` → `fecha-trabajo-invalida`, etc.).

- [x] **Paso 1: Test que falla** en `tests/feedback.test.ts`: cada código de RPC del módulo
  (`vehiculo-invalido`, `vehiculo-inactivo`, `vehiculo-con-solicitudes`, `solicitud-cerrada`,
  `fecha-invalida`, `ya-anulado`, `descripcion-invalida`, `taller-invalido`, `registro-invalido`)
  pasa por `managementErrorCode({ message }, 'movilidad-error')` a un código distinto de
  `'movilidad-error'` y `feedbackMessage` de ese código no es `undefined`.
- [x] **Paso 2: Correr** `npx vitest run tests/feedback.test.ts`. Esperado: FALLA.
- [x] **Paso 3: Implementar** las actions: validar con Zod antes del guard, como
  `request-management-actions.ts`; `revalidatePath('/movilidad', 'layout')` después de cada escritura.
- [x] **Paso 4: Correr** `npm test`, `npm run typecheck`, `npm run lint`. Esperado: PASA.
- [ ] **Paso 5: Commit** (con permiso): `feat: acciones del módulo Movilidad`.

### Tarea 5: Pantallas de vehículos e historial

**Archivos:**
- Crear: `src/app/(app)/movilidad/page.tsx`, `.../movilidad/loading.tsx`,
  `.../movilidad/vehiculos/nuevo/page.tsx`, `.../movilidad/vehiculos/[id]/page.tsx`,
  `.../movilidad/vehiculos/[id]/editar/page.tsx`
- Crear: `src/components/fleet/vehicle-form.tsx`, `vehicle-filters.tsx`, `vehicle-history.tsx`,
  `vehicle-record-form.tsx`

**Interfaces:**
- Consume: actions de la Tarea 4, `vehicleLabel`, `vehicleRecordKindLabels`, `searchTokens` +
  `applySearch` sobre `vehicle_search_text` (sin variantes difusas: grupos de una palabra).

- [x] **Paso 1: Listado `/movilidad`** (`requireFleetAccess`): `PageHeader` «Movilidad» con acciones
  «Nueva solicitud de servicio» y, para el admin, «Nuevo vehículo»; enlace a `/movilidad/solicitudes`;
  filtros `?buscar=`, `?estado=activos|inactivos|todos` (por defecto activos), paginado con
  `pageRange`. Tabla en escritorio y `MobileList` en mobile: identificador, nombre, marca y modelo,
  año, dominio, solicitudes abiertas. Vacío: `EmptyState` «No hay vehículos cargados».
- [x] **Paso 2: Alta y edición** (`requireRole('admin')`), formulario React Hook Form + `vehicleSchema`.
- [x] **Paso 3: Ficha `/movilidad/vehiculos/[id]`** (`requireFleetAccess`; id inválido o inexistente →
  `EmptyState` «No encontramos el vehículo» con «Volver a Movilidad»): datos, botones «Cargar
  mantenimiento», «Pedir reparación» (`/movilidad/solicitudes/nueva?vehiculo=<id>`), «Editar» y
  «Desactivar/Activar» (admin, con `ConfirmSubmit`). Debajo, solicitudes abiertas y la línea de tiempo
  del historial (más reciente primero por `performed_on`, luego `created_at`): tipo, qué, cuándo, dónde,
  quién lo cargó, enlace a `#SRV-n` si cerró una solicitud, anulados tachados con su motivo y botón
  «Anular» (admin, pide motivo).
- [x] **Paso 4: Formulario de registro** (`vehicle-record-form.tsx`): tipo (por defecto Mantenimiento),
  qué se hizo, fecha (por defecto hoy, `max` = hoy en Argentina), taller. Oculto si el vehículo está
  inactivo.
- [ ] **Paso 5: Verificar** `npm run typecheck`, `npm run lint`, `npm run build`; y en la app con un
  usuario de Movilidad y el admin: alta, edición, dominio duplicado, carga de mantenimiento,
  anulación, desactivación bloqueada con solicitud abierta, vista en mobile.
- [ ] **Paso 6: Commit** (con permiso): `feat: vehículos e historial en Movilidad`.

### Tarea 6: Pantallas de solicitudes de servicio

**Archivos:**
- Crear: `src/app/(app)/movilidad/solicitudes/page.tsx`, `.../solicitudes/nueva/page.tsx`,
  `.../solicitudes/[id]/page.tsx`
- Crear: `src/components/fleet/vehicle-request-form.tsx`, `vehicle-request-filters.tsx`,
  `vehicle-request-status-badge.tsx`, `complete-vehicle-request-form.tsx`

**Interfaces:**
- Consume: actions de la Tarea 4; `vehicleRequestStatusLabels`, `formatVehicleRequestNumber`,
  `parseVehicleRequestNumber`; columna `status` y `vehicle_request_search_text` de la Tarea 1.

- [x] **Paso 1: Listado** (`requireFleetAccess`): filtros `?estado=` (`abiertas` por defecto =
  `pending` + `purchase`, cada estado, `todas`), `?vehiculo=<uuid>`, `?buscar=` (un número solo busca
  por número de solicitud o de requerimiento, como `/solicitudes`). Columnas: número, vehículo,
  descripción recortada, estado, fecha, espera (`formatWait`).
- [x] **Paso 2: Nueva** (`requireFleetAccess`): selector de vehículos activos (preseleccionado con
  `?vehiculo=`), descripción del problema. Sin vehículos activos: `EmptyState` que explica que el admin
  tiene que cargarlos.
- [x] **Paso 3: Detalle** (`requireFleetAccess`; inexistente → `EmptyState`): número, vehículo con
  enlace, estado, descripción, quién y cuándo. Abierta: tarjeta de requerimiento de compra (admin,
  reutilizar el patrón de `src/app/(app)/solicitudes/[id]/page.tsx`), formulario «Completar» (qué se
  reparó, cuándo, dónde) y «Cancelar» con motivo. Completada: el registro que la cerró. Cancelada:
  motivo, quién y cuándo. Actividad desde `audit_events` de la solicitud.
- [ ] **Paso 4: Verificar** `npm run typecheck`, `npm run lint`, `npm run build`; y en la app el
  circuito completo: crear → requerimiento → completar → aparece en el historial → anular el registro
  → vuelve a «En compras»; cancelar; doble envío de «Completar».
- [ ] **Paso 5: Commit** (con permiso): `feat: solicitudes de servicio en Movilidad`.

### Tarea 7: Notificaciones y auditoría

**Archivos:**
- Crear: `supabase/migrations/202610280002_fleet_notifications.sql`
- Modificar: `src/lib/notification-items.ts`, `src/lib/notifications.ts`, `src/lib/audit.ts`,
  `src/components/audit/audit-filters.tsx` si lista acciones
- Test: `tests/notifications.test.ts`, `supabase/checks/movilidad.sql`

**Interfaces:**
- Consume: acciones de auditoría de la Tarea 1.
- Produce: `notifications.request_id` pasa a null; columna `vehicle_request_id uuid null references
  vehicle_requests`; check «exactamente una de las dos»; kinds nuevos `vehicle_request.created`,
  `vehicle_request.purchase_requirement`, `vehicle_request.completed`, `vehicle_request.cancelled`.
  `notify_from_audit` suma la rama `entity_type = 'vehicle_request'`: destinatarios admins activos y
  solicitantes activos con rubro `fleet`, salvo el autor. `NOTIFICATION_SELECT` suma
  `vehicle_request:vehicle_requests(request_number, vehicle:vehicles(name, plate, internal_code))`;
  `notificationHref` lleva a `/movilidad/solicitudes/<id>`; `auditEntityHref('vehicle', id)` →
  `/movilidad/vehiculos/<id>` y `('vehicle_request', id)` → `/movilidad/solicitudes/<id>`.

- [x] **Paso 1: Tests que fallan** en `tests/notifications.test.ts`: `notificationText` para
  `vehicle_request.created` con `requestNumber` 15 y vehículo `Blanco 01` contiene `#SRV-15` y
  `Blanco 01`; `notificationHref('vehicle_request.completed', id)` es `/movilidad/solicitudes/<id>`;
  `auditActionLabel('vehicle_record.voided')` es «Registro de vehículo anulado».
- [x] **Paso 2: Correr** `npx vitest run tests/notifications.test.ts`. Esperado: FALLA.
- [x] **Paso 3: Implementar** la migración (reescribir `notify_from_audit` completa, con las ramas
  existentes intactas) y los cambios en TS. Agregar a `supabase/checks/movilidad.sql`: completar una
  solicitud como usuario `fleet` genera notificación para el admin y no para el autor ni para el
  usuario `pharmacy`.
- [x] **Paso 4: Correr** `npm test`, `npm run typecheck`; pedir al usuario que aplique la migración y
  corra los checks. Esperado: PASA.
- [ ] **Paso 5: Commit** (con permiso): `feat: notificaciones y auditoría de Movilidad`.

### Tarea 8: Documentación y cierre

**Archivos:**
- Modificar: `docs/ui-reference/UI-SPEC.md` (sección Movilidad), `README.md`, `CLAUDE.md` (módulo y
  `fleet-actions.ts` en la lista de actions), este plan (marcar `[x]` y anotar decisiones).

- [x] **Paso 1: Documentar** pantallas, permisos y estados; en el README, cómo habilitar el módulo:
  crear la dependencia «Movilidad» en `/centros` y asignar el rubro Movilidad a sus usuarios.
- [x] **Paso 2: Verificación final:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
  Esperado: sin errores.
- [ ] **Paso 3: Commit** (con permiso): `docs: módulo Movilidad`.

## Decisiones

Tomadas durante la implementación (2026-10-29):

- [x] **Verificación SQL local con PGlite.** `supabase/checks/movilidad.sql` es autocontenido (crea sus
  usuarios y datos y hace rollback) y se probó contra todas las migraciones en Postgres local (PGlite con
  los permisos por defecto de Supabase): 60/60 «ok». Falta correrlo en el proyecto de desarrollo.
- [x] **La rama sale de `chore/actualizar-dependencias`**, no de `develop`: el código nuevo usa la API de
  zod 4.
- [x] **Estado calculado `vehicle_request_status`** (no `status`, nombre genérico en `public`); los
  selects lo aliasan como `status`.
- [x] **`fleet_actor_names()`**: el solicitante solo ve su propio perfil, así que los nombres de quienes
  operaron en Movilidad salen de esta RPC. El detalle de la solicitud muestra su ciclo desde las columnas
  de la fila, no desde `audit_events` (que solo ve el admin).
- [x] **Año posterior al próximo** se valida en el trigger (`anio-invalido`): un `check` no puede depender
  de la fecha actual.
- [x] **`getAreas(includeInactive, includeFleet)`**: por defecto solo rubros de insumos; usuarios (alta,
  edición, listado) y perfil piden también Movilidad para poder asignarla y mostrarla.
- [x] **Menús en `src/lib/navigation.ts`** (testeables); el desglose por rubro del panel excluye Movilidad.
- [x] **Búsqueda de vehículos y solicitudes de servicio sin variantes por errores de tipeo**:
  `search_variants` tiene ámbitos fijos.
- [x] **`PurchaseRequirementCard`** recibe `action` y `hint` para reutilizarse en Movilidad.
- [ ] Adjuntos (factura, presupuesto): segunda etapa.
