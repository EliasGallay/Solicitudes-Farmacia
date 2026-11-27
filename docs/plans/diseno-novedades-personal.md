# Diseño: Novedades de personal

Estado: implementado genérico en `feat/novedades-personal` (2026-11-27), sin commitear.
Base: `origin/develop` (incluye el módulo de gestión de personal, PR #59; ver `diseno-gestion-personal.md`).

## Objetivo

Registrar, dentro de la ficha de cada persona, hechos que no son licencias: ausencias, llegadas
tarde, informes, sanciones u otras novedades del trabajador. Solo admin.

La categoría es libre, no un catálogo cerrado. La UI ofrece sugerencias ("Ausencia injustificada",
"Llegada tarde", "Informe", "Otra"), pero el admin puede escribir cualquiera.

Caso que motiva el diseño: ausencia sin aviso el 19/11. Después se pide un informe el 20/11 y llega
el 26/11. Eso se registra como una novedad con dos eventos de seguimiento.

## Fuera de alcance (v1)

- Adjuntar archivos (informes, fotos). Queda para una iteración posterior.
- Editar o borrar eventos de seguimiento: se agregan, no se editan.
- Sanciones, descuentos o cálculos vinculados a la novedad.
- Acceso de lectura para roles que no sean admin.
- Notificaciones.

## Modelo de datos

Tabla `public.staff_incidents` (la novedad):

- `id uuid` primary key.
- `staff_member_id uuid` not null, FK a `staff_members` (`on delete restrict`).
- `category text` not null, 1 a 60 caracteres, sin espacios en los bordes. Libre.
- `occurred_on date` not null: fecha del hecho. No puede ser futura.
- `ends_on date` nullable: fin del hecho si abarca varios días. Si existe, `ends_on >= occurred_on`
  y no puede ser futura.
- `description text` nullable, 1 a 500 caracteres.
- `created_at`, `created_by` (FK a `profiles`), `voided_at`, `voided_by`, `void_reason`
  (not null cuando `voided_at` existe, 1 a 500 caracteres).

Tabla `public.staff_incident_events` (seguimiento, solo se agrega):

- `id uuid` primary key.
- `incident_id uuid` not null, FK a `staff_incidents` (`on delete restrict`).
- `event_on date` not null: fecha del evento. Entre `occurred_on` y hoy (inclusive).
- `note text` not null, 1 a 500 caracteres, sin espacios en los bordes.
- `created_at`, `created_by` (FK a `profiles`).

Nada se borra. Las novedades se anulan con motivo; los eventos no se anulan en v1.

RLS: habilitada en ambas tablas, con select solo para admin, igual que el resto del módulo.

## RPCs (security definer, con auditoría)

- `staff_register_incident(p_staff_member_id, p_category, p_occurred_on, p_ends_on, p_description)`:
  valida, inserta y escribe `audit_events`.
- `staff_add_incident_event(p_incident_id, p_event_on, p_note)`: agrega un evento de seguimiento.
  Falla si la novedad está anulada. Escribe `audit_events`.
- `staff_void_incident(p_id, p_reason)`: marca `voided_at` y `void_reason`; falla si ya está
  anulada. Escribe `audit_events`.

Los códigos de error siguen el patrón `staff_invalid_*` que ya usa el módulo. Se traducen en
`src/lib/feedback.ts` y en el mapeo de `src/lib/request-management.ts`.

## Reglas

- No cuenta como licencia: no entra en la validación de solapamientos ni en la vista de
  "quién está de licencia en una fecha".
- Las novedades anuladas se muestran marcadas, como las licencias anuladas.
- Los eventos se muestran en orden cronológico dentro de la novedad.

## UI

- En la ficha de la persona, sección **Novedades** debajo de licencias.
- Botón "Registrar novedad": formulario con categoría (con sugerencias), fecha del hecho, fin
  opcional y descripción opcional.
- Cada novedad muestra sus eventos y un botón "Agregar seguimiento" (fecha y texto).
- Lista ordenada por fecha del hecho, con anuladas visibles y marcadas.
- Anulación con motivo obligatorio.

## Tests

- Validación pura en `src/lib/staff.ts` (categoría, rangos, eventos dentro del rango) con tests en
  `tests/staff.test.ts`.
- Verificación SQL en `supabase/checks/personal.sql`: registrar, rechazar fechas futuras y rangos
  invertidos, agregar seguimiento, rechazar evento fuera de rango, anular, rechazar doble anulación
  y evento en novedad anulada, y que un no-admin no pueda escribir.

## Migración

Archivo `supabase/migrations/202611270001_staff_incidents.sql`, después de
`202611260001_staff.sql`. Se aplica a mano según el README, igual que las anteriores.

## Decisiones tomadas por defecto (revisables)

- Categoría libre con sugerencias, no catálogo cerrado. Sin tabla de categorías en v1.
- Seguimiento como eventos agregados, no como campos fijos de fechas de informe.
- Sin adjuntos en v1.

## Tareas

- [x] T1: migración, tablas y RPCs, con check SQL.
- [x] T2: validación pura y tests unitarios.
- [x] T3: sección Novedades en la ficha (alta, seguimiento, anulación).
- [x] T4: mensajes de feedback y mapeo de errores.
- [x] T5: README con el orden de migraciones.
