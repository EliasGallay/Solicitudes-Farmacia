# Plan de implementación: archivos de evidencia en Movilidad

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes
> (`- [ ]`) para el seguimiento.

**Objetivo:** adjuntar archivos clasificados (presupuesto, factura, fotos, etc.) a solicitudes de servicio
y a registros del historial de vehículos, con borrado lógico por quien lo subió o el admin.

**Arquitectura:** bucket privado `movilidad-evidencias` + tabla `fleet_evidence` (un archivo es de una
solicitud o de un registro) + tabla `evidence_document_types` (lista en la base). El navegador sube cada
archivo a una server action, que lo guarda en Storage y lo registra con una RPC `security definer` que
valida y audita. El borrado es una RPC que marca `deleted_at`; nada se elimina de Storage salvo un objeto
que nunca llegó a registrarse.

**Stack:** Next.js 15 + React 19, Supabase (Postgres, Storage, RLS), Zod 4, Vitest. Base local:
`npx supabase start` (contenedor `supabase_db_solicitudes-farmacia`).

**Spec:** `docs/plans/diseno-movilidad-adjuntos.md` (extiende `docs/plans/diseno-movilidad.md`).

## Restricciones globales

- Las de `docs/plans/plan-movilidad.md` (castellano rioplatense, sin commits sin permiso, guard en cada
  página y action, helpers internos revocados de `public, anon, authenticated`, feedback por códigos,
  límites iguales en Zod y en la base, nada se borra).
- Tipos de archivo: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Máximo 10 MB
  (`10485760` bytes) por archivo. `serverActions.bodySizeLimit` = `'11mb'`.
- «Otro»: texto libre obligatorio, 1 a 60 caracteres; en los demás tipos el texto se guarda `null`.
- Nombre original: hasta 200 caracteres (se recorta antes de guardar).
- Ruta en el bucket: `solicitudes/<vehicle_request_id>/<uuid>.<ext>` o `registros/<vehicle_record_id>/<uuid>.<ext>`.
- Verificación SQL: `supabase/checks/movilidad.sql` contra el Supabase local
  (`docker exec -i supabase_db_solicitudes-farmacia psql -U postgres -d postgres -q -t -A -v ON_ERROR_STOP=1 < supabase/checks/movilidad.sql`).

## Foco de revisión

1. **Un usuario de Movilidad borra un archivo que subió otro** → «sin-permiso»; el admin sí puede. →
   Check SQL en la Tarea 1.
2. **Archivo borrado o usuario sin Movilidad**: la lista no lo devuelve y Storage no deja leer el objeto
   (no se puede generar un enlace). → Check SQL en la Tarea 1.
3. **Ruta manipulada** (registrar un archivo subido en la carpeta de otra solicitud, o una ruta que no
   existe en Storage) → «archivo-invalido». → Check SQL en la Tarea 1.
4. **«Otro» sin texto** → rechazado en Zod y en la base. → Test en la Tarea 2 y check SQL en la Tarea 1.
5. **Varios archivos con uno inválido** (HEIC, más de 10 MB): los válidos se suben y se informa cuál
   falló. → Test de `summarizeUploads` en la Tarea 2.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/202610290001_fleet_evidence.sql` | Bucket, tipos, tabla, RLS, políticas de Storage, RPCs |
| `src/lib/fleet-evidence.ts` | Constantes, rutas, validación, mensajes de subida, lectura con enlaces firmados |
| `src/lib/image-compression.ts` | `compressImage` (cliente), extraída de `signed-note-input.tsx` |
| `src/app/fleet-actions.ts` (mod.) | `uploadFleetEvidence`, `deleteFleetEvidence` |
| `src/components/fleet/evidence-list.tsx`, `evidence-upload-form.tsx` | Lista y formulario |
| Pantallas `movilidad/solicitudes/[id]` y `movilidad/vehiculos/[id]` + `vehicle-history.tsx` (mod.) | Integración |
| `tests/fleet-evidence.test.ts` | Tests del módulo |

### Tarea 1: Migración y checks

**Archivos:** crear `supabase/migrations/202610290001_fleet_evidence.sql`; modificar
`supabase/checks/movilidad.sql`, `README.md` (paso de migración).

**Interfaces (produce):**
- `evidence_document_types(key text pk, name text, sort_order int, active bool)` con las filas del
  diseño (`budget` … `other`, en ese orden).
- `fleet_evidence(id, vehicle_request_id uuid null, vehicle_record_id uuid null` (exactamente uno)`,
  document_type text fk, document_type_other text null, storage_path text unique, original_name text,
  content_type text, size_bytes int, created_at, created_by, deleted_at, deleted_by)` con checks de
  consistencia (`other` ⇔ texto; borrado: ambos o ninguno).
- RLS lectura: `has_area('fleet') and deleted_at is null`. Sin grants de escritura.
- Storage `movilidad-evidencias`: insert si `has_area('fleet')` y la primera carpeta es `solicitudes` o
  `registros`; select si hay una fila no borrada con ese `storage_path` y `has_area('fleet')`; delete
  solo si `owner_id = auth.uid()::text` y no hay fila registrada.
- `add_fleet_evidence(target_request_id uuid, target_record_id uuid, evidence_type text, evidence_type_other text, evidence_path text, evidence_name text) returns uuid`:
  exige `has_area('fleet')`, exactamente un destino existente, tipo activo, texto según tipo, ruta con el
  prefijo del destino, objeto existente en el bucket con `metadata->>'mimetype'` permitido y
  `(metadata->>'size')::int` ≤ 10485760. Audita `fleet_evidence.added` (`entity_type`
  `vehicle_request` con el id de la solicitud, o `vehicle` con el id del vehículo del registro).
- `delete_fleet_evidence(target_evidence_id uuid) returns void`: bloquea la fila; `archivo-invalido` si no
  existe, `ya-borrado` si ya está borrada, `sin-permiso` si no es quien la subió ni admin. Audita
  `fleet_evidence.deleted`.
- Códigos nuevos: `archivo-invalido`, `tipo-documento-invalido`, `ya-borrado`.

- [x] **Paso 1: Checks que fallan** en `supabase/checks/movilidad.sql` (sección nueva al final del bloque,
  con objetos de Storage insertados como postgres en `storage.objects` con `metadata` `{"mimetype":"application/pdf","size":1000}`):
  admin y Movilidad registran; segundo usuario de Movilidad no borra lo de otro (`sin-permiso`); quien lo
  subió borra; admin borra; borrar dos veces (`ya-borrado`); borrado no aparece en `fleet_evidence` para
  Movilidad; farmacia ve 0 filas; ruta de otra solicitud (`archivo-invalido`); ruta inexistente
  (`archivo-invalido`); `other` sin texto (`tipo-documento-invalido`); `content_type` `text/html`
  (`archivo-invalido`); auditoría `fleet_evidence.added`/`deleted`; helpers sin acceso desde la API y RPCs
  sin `anon`.
- [x] **Paso 2: Correr** los checks contra el Supabase local. Esperado: FALLA (no existe la tabla).
- [x] **Paso 3: Escribir la migración** con el estilo de `202610280001_fleet.sql`.
- [x] **Paso 4: Aplicar en local** (`npx supabase migration up`) y **correr** los checks. Esperado: todos
  «ok».
- [ ] **Paso 5: Commit** (con permiso): `feat: archivos de evidencia de Movilidad en la base`.

### Tarea 2: Lógica en TypeScript

**Archivos:** crear `src/lib/fleet-evidence.ts`, `src/lib/image-compression.ts`, `tests/fleet-evidence.test.ts`;
modificar `src/components/deliveries/signed-note-input.tsx` (usar `compressImage` extraída).

**Interfaces (produce):**
- `FLEET_EVIDENCE_BUCKET = 'movilidad-evidencias'`, `FLEET_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024`,
  `EVIDENCE_OTHER_MAX = 60`, `EVIDENCE_NAME_MAX = 200`, `OTHER_DOCUMENT_TYPE = 'other'`.
- `isEvidenceContentType(type: string): boolean` (mismos 4 tipos).
- `evidencePath(target: EvidenceTarget, contentType: EvidenceContentType, fileId?: string): string`, con
  `type EvidenceTarget = { kind: 'request' | 'record'; id: string }`.
- `evidenceTypeSchema`: `{ document_type: string (clave), document_type_other: string }` →
  `document_type_other` obligatorio (1–60) si `document_type === 'other'`, `null` si no.
- `evidenceName(name: string): string` (recorta a 200).
- `summarizeUploads(results: { name: string; error: string | null }[]): { uploaded: number; failed: { name: string; error: string }[] }`.
- `getEvidence(supabase, filter: { requestIds?: string[]; recordIds?: string[] }): Promise<Evidence[]>` con
  enlace firmado de 1 hora; `Evidence = { id, requestId, recordId, typeLabel, name, isPdf, url, createdAt, createdBy, createdById }`.
- `getEvidenceTypes(supabase): Promise<{ key: string; name: string }[]>` (activos, por `sort_order`).
- `compressImage(file: File, maxBytes: number, name: string): Promise<File>` en `image-compression.ts`.

- [x] **Paso 1: Tests que fallan** en `tests/fleet-evidence.test.ts`:

```ts
it('guarda en la carpeta de la solicitud', () => expect(evidencePath({ kind: 'request', id: 'r1' }, 'application/pdf', 'abc')).toBe('solicitudes/r1/abc.pdf'))
it('guarda en la carpeta del registro', () => expect(evidencePath({ kind: 'record', id: 'x1' }, 'image/jpeg', 'abc')).toBe('registros/x1/abc.jpg'))
it.each(['image/heic', 'text/html', 'toString'])('rechaza %s', (type) => expect(isEvidenceContentType(type)).toBe(false))
it('«Otro» exige texto', () => expect(evidenceTypeSchema.safeParse({ document_type: 'other', document_type_other: ' ' }).success).toBe(false))
it('otros tipos descartan el texto', () => expect(evidenceTypeSchema.parse({ document_type: 'budget', document_type_other: 'x' }).document_type_other).toBeNull())
it('recorta el nombre a 200', () => expect(evidenceName('a'.repeat(250) + '.pdf')).toHaveLength(200))
it('resume una subida con fallas', () => expect(summarizeUploads([{ name: 'a.pdf', error: null }, { name: 'b.heic', error: 'Tipo no permitido' }])).toEqual({ uploaded: 1, failed: [{ name: 'b.heic', error: 'Tipo no permitido' }] }))
```

- [x] **Paso 2: Correr** `npx vitest run tests/fleet-evidence.test.ts`. Esperado: FALLA.
- [x] **Paso 3: Implementar**; `signed-note-input.tsx` pasa a llamar
  `compressImage(file, SIGNED_NOTE_MAX_BYTES, 'remito-firmado.jpg')` sin cambiar su comportamiento.
- [x] **Paso 4: Correr** `npm test` y `npm run typecheck`. Esperado: PASA.
- [ ] **Paso 5: Commit** (con permiso): `feat: reglas de archivos de evidencia`.

### Tarea 3: Server actions y mensajes

**Archivos:** modificar `src/app/fleet-actions.ts`, `src/lib/feedback.ts`, `src/lib/request-management.ts`,
`next.config.ts`, `tests/feedback.test.ts`.

**Interfaces (produce):**
- `uploadFleetEvidence(target: EvidenceTarget, values: { document_type: string; document_type_other: string }, formData: FormData): Promise<{ error: string | null }>`:
  un archivo (`file`) por llamada; valida tipo y tamaño; `requireFleetAccess`; sube con
  `upsert: false`; llama a `add_fleet_evidence`; si la RPC falla, borra el objeto subido. No redirige:
  el formulario llama a `router.refresh()` al terminar. Revalida `/movilidad`.
- `deleteFleetEvidence(formData: FormData)` (`evidence_id`, `return_to` validado con
  `startsWith('/movilidad/')`): llama a `delete_fleet_evidence` y redirige con `archivo-borrado`.
- Códigos de feedback: `archivo-borrado`, `archivo-invalido`, `archivo-tipo-invalido`,
  `archivo-muy-grande`, `archivo-subida-error`, `tipo-documento-invalido`, `archivo-ya-borrado`;
  `rpcErrorCodes`: `archivo-invalido`, `tipo-documento-invalido`, `ya-borrado` → `archivo-ya-borrado`,
  `sin-permiso` → `sin-permiso-archivo` (mensaje «Solo quien subió el archivo o el administrador pueden
  borrarlo.»).

- [x] **Paso 1: Test que falla** en `tests/feedback.test.ts`: cada código RPC nuevo se traduce a un
  mensaje propio (mismo patrón que «errores de las RPCs de Movilidad»).
- [x] **Paso 2: Correr**. Esperado: FALLA.
- [x] **Paso 3: Implementar** y subir `bodySizeLimit` a `'11mb'`.
- [x] **Paso 4: Correr** `npm test`, `npm run typecheck`, `npm run lint`. Esperado: PASA.
- [ ] **Paso 5: Commit** (con permiso): `feat: acciones de archivos de evidencia`.

### Tarea 4: Pantallas y auditoría

**Archivos:** crear `src/components/fleet/evidence-list.tsx`, `src/components/fleet/evidence-upload-form.tsx`;
modificar `src/app/(app)/movilidad/solicitudes/[id]/page.tsx`, `src/app/(app)/movilidad/vehiculos/[id]/page.tsx`,
`src/components/fleet/vehicle-history.tsx`, `src/lib/audit.ts`, `tests/audit.test.ts`.

**Interfaces (consume):** Tareas 2 y 3.

- [x] **Paso 1: Test que falla** en `tests/audit.test.ts`: `auditActionLabel('fleet_evidence.added')` es
  «Archivo adjuntado (Movilidad)» y `'fleet_evidence.deleted'` es «Archivo borrado (Movilidad)».
- [x] **Paso 2: Correr**. Esperado: FALLA.
- [x] **Paso 3: Implementar**:
  - `EvidenceList({ items, currentUserId, isAdmin, returnTo })`: tipo, nombre (abre el enlace en otra
    pestaña), quién y cuándo, «Borrar» con `ConfirmSubmit` si es suyo o admin; vacío: «Sin archivos».
  - `EvidenceUploadForm({ target, types })`: selector de tipo, texto si es «Otro», input múltiple
    (`accept` con los 4 tipos); comprime fotos; sube de a uno; muestra el resumen de `summarizeUploads`
    y llama a `router.refresh()`.
  - Detalle de solicitud: tarjeta «Archivos» con lista y formulario (en cualquier estado).
  - Ficha del vehículo: una sola consulta `getEvidence` con los ids de registros y de solicitudes
    vinculadas; cada registro muestra los suyos y, si cerró una solicitud, los de la solicitud con la
    marca «de la solicitud #SRV-n»; «Adjuntar» por registro abre el formulario en un `<details>`.
  - Etiquetas de auditoría.
- [x] **Paso 4: Verificar** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Esperado:
  sin errores.
- [ ] **Paso 5: Verificar en la app** (Supabase local, `movilidad@local.test` y `admin@local.test`): subir
  PDF y foto a una solicitud y a un registro, ver el archivo, «Otro» con texto, borrar el propio, no ver
  «Borrar» en uno ajeno, borrar como admin, archivos de la solicitud en el registro que la cerró.
- [ ] **Paso 6: Commit** (con permiso): `feat: archivos de evidencia en Movilidad`.

### Tarea 5: Documentación

- [x] **Paso 1:** UI-SPEC §9.3 (archivos), README (paso de migración y funcionalidad), `CLAUDE.md` (una
  línea), marcar este plan y anotar decisiones.
- [x] **Paso 2:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, checks SQL locales.
  Esperado: todo en verde.
- [ ] **Paso 3: Commit** (con permiso): `docs: archivos de evidencia en Movilidad`.

## Decisiones

Tomadas durante la implementación (2026-10-29):

- [x] **Checks SQL contra el Supabase local**, con dominios e identificadores únicos por corrida para no
  chocar con vehículos reales: 90/90 «ok». Prueba de punta a punta de Storage por API: 17/17.
- [x] **Solo quien subió un objeto puede registrarlo** (`owner_id` = quien llama).
- [x] **`fleet_actor_names()` suma a quienes subieron archivos**: si no, un archivo de otro usuario mostraba
  «usuario no disponible».
- [x] **Quien subió un objeto lo puede leer mientras no esté registrado**: la API de Storage pide lectura
  para eliminar, y así se limpia un archivo cuyo registro falló.
- [x] **`fleet_evidence_path_registered()`** (security definer) para la política de borrado de Storage,
  porque RLS oculta los archivos borrados.
- [x] **`sin-permiso` se traduce a un mensaje genérico**; solo el borrado de archivos usa «Solo quien subió
  el archivo o el administrador pueden borrarlo».
- [x] **La compresión de fotos pasa a `src/lib/image-compression.ts`** y la usa también el remito firmado.
- [x] **Los archivos se abren por `/movilidad/archivos/[id]`** (guard + RLS + enlace firmado de 60 s), no
  con enlaces firmados de 1 hora: estos funcionaban para cualquiera con el enlace y seguían andando después
  del borrado (revisión final).
- [x] **El ciclo de subida (`runUploads`) captura el error de cada archivo** y el formulario conserva solo
  los que fallaron: una excepción ya no tira la pantalla y reintentar no duplica (revisión final).
- [ ] Prueba de la interfaz en el navegador (subir, ver, borrar): pendiente del usuario.
