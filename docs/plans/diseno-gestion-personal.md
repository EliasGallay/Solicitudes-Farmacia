# Diseño: Gestión de personal (vacaciones y permisos por horas)

Fecha: 2026-11-26. Estado: aprobado por el usuario. Sin commits.

## Intención

Reemplazar la planilla "Copia de LAO salud_.xlsx" por un módulo dentro de la app, solo para el
admin. La administrativa carga las licencias del personal de salud, y el sistema permite leer
rápido qué tomó cada persona. El personal **no tiene login**: sus registros son datos que carga
el admin.

## Objetivos

- Ficha por persona: nombre y apellido (obligatorios); profesión, matrícula, DNI, teléfono,
  dirección, email, fecha de nacimiento, fecha de ingreso y uno o más CAPS (todos opcionales).
- Registrar vacaciones con rango de fechas y **cantidad de días** como campos independientes
  (el rango puede incluir fines de semana o feriados).
- Registrar permisos de **3 hs** o **1,5 hs** por fecha.
- Ver el historial de cada persona y quién está de licencia en una fecha.

## No objetivos

- Login, perfiles o roles para el personal.
- Saldo de días de vacaciones (no hay dato de días asignados por año; se registra solo lo tomado).
- Cálculo automático de días hábiles o feriados.
- Cumpleaños (estaban en la planilla, pero no se pidieron).
- Importar la planilla actual (pendiente de decisión, ver "Abierto").

## Restricciones

- Solo admin lee y escribe. Guard: `requireRole('admin')` en cada página y acción; RLS con
  `current_app_role() = 'admin'`.
- Las escrituras multi-fila van por RPCs `security definer` que bloquean, validan y escriben en
  `audit_events` en la misma transacción (patrón de `docs/` y de Movilidad).
- Nada se borra: una licencia cargada por error se anula con motivo.
- Textos de UI, comentarios y mensajes en español. Códigos de feedback en `src/lib/feedback.ts`.
- Migraciones: las aplica `.github/workflows/migrations.yml` al mergear en `develop` (preview) y en
  `main` (producción), en orden de nombre de archivo. No se aplican a mano.
- **Datos del personal solo en producción (`main`).** Nunca en `develop`: la seed de `develop`
  (`supabase/seed/datos-prueba-develop.sql`) no puede tener personal real, y `develop` no recibe
  ninguna carga de este módulo. Las pruebas en `develop` usan datos ficticios, o van en tests y
  checks con rollback.
- Cargar datos en producción requiere autorización explícita para cada carga (CLAUDE.md). No se
  ejecuta desde el repo sin esa autorización.

## Enfoques considerados

1. **Tablas normalizadas + RPCs (recomendado).** `staff_members`, relación con `health_centers`
   y `staff_leaves` con un tipo por fila. Permite filtrar por CAPS y por fecha, y mantiene la
   integridad (no solapamientos, rangos válidos) en la base.
2. **Una sola tabla con texto libre** (como la planilla). Carga rápida, pero no se puede
   filtrar ni validar. Descartado: es el problema que se quiere resolver.
3. **Reutilizar `requests`/`request_items`**. Modelan pedidos de insumos con cantidades y
   estados de entrega; forzarlos a licencias mezcla dominios. Descartado.

## Modelo de datos

```text
staff_members            id, first_name, last_name,           -- obligatorios
                         profession, matricula, dni, phone, address, email,
                         birth_date, hire_date, comment,      -- opcionales
                         active, created_at, created_by, updated_at, updated_by
staff_member_health_centers   staff_member_id, health_center_id   (PK compuesta)
staff_leaves             id, staff_member_id, kind ('vacation' | 'hours_permit' | 'other'),
                         starts_on date, ends_on date,        -- vacaciones y otras: rango
                         days integer,                        -- vacaciones y otras: días descontados
                         hours numeric(3,1),                  -- permisos: 1.5 o 3
                         note text,                           -- obligatoria en 'other'
                         comment text,                        -- comentario libre, opcional, en cualquier tipo
                         created_at, created_by, voided_at, voided_by, void_reason
```

Restricciones principales:

- `kind = 'vacation'`: `ends_on >= starts_on`, `days >= 1`, `hours is null`.
- `kind = 'hours_permit'`: `starts_on = ends_on`, `hours in (1.5, 3)`, `days is null`.
- `kind = 'other'`: rango como vacaciones, `note` no vacía. (Mi decisión: cubre compensatorios y
  estudios que aparecen en la planilla.)
- `comment` (persona y licencia): opcional, texto libre, máximo 500 caracteres, sin espacios
  sobrantes al inicio o al final. Se edita en la ficha; no reemplaza el campo `note` de "otra".
- Datos personales (profesión, matrícula, DNI, teléfono, dirección, email, nacimiento, ingreso):
  todos opcionales, con largo máximo y `btrim` en la base, igual que el resto. Como el
  nombre y apellido son obligatorios, un alta sin datos extra es válida.
- Datos sensibles (DNI, teléfono, dirección, email): solo admin, igual que el resto del módulo.
  No aparecen en el listado ni en el panel de licencias.
- Mismo largo máximo y mismas reglas de `btrim` en TS (`src/lib/staff.ts`) y en la base, como
  en Movilidad.
- No se permite solapar licencias de vacaciones/otras de la misma persona: lo valida la RPC.

## RPCs (todas `security definer`, solo admin)

- `staff_create_member(...)`, `staff_update_member(...)`: ficha y CAPS en una sola operación.
- `staff_register_leave(...)`: valida tipo, fechas, días u horas y solapamientos; escribe auditoría.
- `staff_void_leave(id, reason)`: anula con motivo, sin borrar.

Los códigos de error de cada RPC se traducen con `managementErrorCode()` a códigos de feedback,
según el patrón existente.

## Pantallas

- **Sidebar (admin):** ítem nuevo "Gestión de personal" en `adminNavigation`
  (`src/lib/navigation.ts`), con ruta `/personal`.
- **`/personal`** (panel de licencias): solo nombre y apellido, búsqueda por nombre (sin acentos)
  y filtro por CAPS. Botón para cargar persona. Sección "De licencia en la fecha" con selector
  de fecha. No muestra datos personales.
- **`/personal/[id]`** (ficha): todos los datos de la persona, incluidos los personales, y CAPS,
  editables. Botón "Registrar licencia" e historial ordenado por fecha, con anulados visibles
  y marcados. Es el único lugar donde aparecen los datos personales.
- **Formulario de licencia:** tipo (vacaciones / permiso por horas / otra). Vacaciones: desde,
  hasta y días, como campos separados. Permiso: fecha y horas (1,5 o 3). Otra: rango y nota.

Mi decisión sobre "Reintegra": el sistema muestra "hasta" y "vuelve el" (hasta + 1), sin
calcular días hábiles.

## Permisos y auditoría

- Lectura y escritura: solo admin (RLS y guard).
- Cada alta, edición, anulación y cambio de CAPS escribe en `audit_events`.

## Pruebas previstas

- Tests de validación de TS (`tests/staff.test.ts`): rangos, días >= 1, horas en {1.5, 3},
  nota obligatoria en "otra", normalización de nombres.
- Verificación SQL (`supabase/checks/personal.sql`, autocontenida y con rollback): RLS, rechazo
  de no-admin, solapamientos, anulación sin borrado, auditoría.

## Abierto

- **Decidido (2026-11-26):** el personal actual entra a producción con un script de importación
  one-off desde la planilla. Nada va a `develop`.
  - El script lee la planilla y produce un listado de revisión (personas duplicadas, nombres
    normalizados, licencias interpretadas y las que no pudo interpretar). Ese listado se revisa
    antes de cargar. No escribe en la base en la misma pasada.
  - La carga contra producción requiere autorización explícita para cada ejecución.
  - La planilla no tiene profesión, CAPS ni datos personales. Quedan vacíos tras la importación
    y se completan en la ficha. Solo nombre y apellido son obligatorios.
  - Las licencias de la planilla que tengan rango y días se importan como vacaciones; las que
    tengan solo horas, como permisos; el resto, como "otra" con su texto original en la nota.
- **Mi decisión, a confirmar:** tipo "otra licencia" para compensatorios y estudios.
- **Mi decisión, a confirmar:** CAPS con `health_centers` existentes, sin catálogo nuevo.

## Lectura como constructor (revisión sin subagente)

- ¿Un constructor puede implementar sin preguntar? Sí, salvo la importación y los tipos de otra
  licencia, que están marcados.
- ¿Hay contradicciones con el proyecto? No: sigue el patrón de Movilidad (módulo con tablas
  propias, RPCs, checks SQL y plan en `docs/plans/`).
