# Plan de implementación: Gestión de personal (vacaciones y permisos por horas)

> **Para agentes:** SUB-SKILL REQUERIDO: usar superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes
> (`- [ ]`) para el seguimiento.

**Objetivo:** registrar personal de salud con sus datos, sus CAPS y sus licencias (vacaciones, permisos
de 3 hs / 1,5 hs, otras), con historial por persona y vista de quién está de licencia en una fecha. Solo
admin. Incluye el script de importación de la planilla a producción.

**Arquitectura:** tablas propias (`staff_members`, `staff_member_health_centers`, `staff_leaves`). Toda
escritura pasa por RPCs `security definer` que validan, bloquean filas y escriben `audit_events`, como en
Movilidad. Sin login para el personal: los registros los carga el admin.

**Stack:** Next.js 16 App Router + React 19, Supabase (Postgres, RLS, RPC), Zod 4, React Hook Form,
Vitest.

**Spec:** `docs/plans/diseno-gestion-personal.md` (aprobado el 2026-11-26).

## Restricciones globales

- Textos de UI, comentarios, docs y commits en castellano rioplatense.
- Nunca commitear sin permiso explícito del usuario; sin atribución de IA en commits ni PRs.
- Migraciones: las aplica `.github/workflows/migrations.yml` al mergear en `develop` y en `main`. No se
  aplican a mano.
- **Ningún dato del personal entra a `develop`.** La seed de `develop` no se toca. Las pruebas usan datos
  ficticios, o van en tests y checks con rollback.
- Cargar datos en producción requiere autorización explícita del usuario para cada ejecución.
- Guard en **cada** página y server action: `requireRole('admin')`. La base repite la regla con RLS y RPCs.
- Toda función `security definer` interna: `revoke execute ... from public, anon, authenticated`. Las
  expuestas: `revoke ... from public, anon` + `grant ... to authenticated`.
- Feedback solo por códigos ASCII en la URL (`withFeedback`); mensajes en `src/lib/feedback.ts`. Errores de
  RPC: códigos cortos traducidos en `rpcErrorCodes` (`src/lib/request-management.ts`).
- Límites de Zod iguales a los `check` de la base:
  - nombre y apellido: 1 a 80.
  - profesión, matrícula, dirección, email: 1 a 120.
  - DNI: 7 a 9 dígitos. Teléfono: 1 a 30.
  - comentario y nota: 500.
- Fechas: `birth_date` y `hire_date` no posteriores a hoy en Argentina (`argentinaDate` de
  `src/lib/requests.ts`). `starts_on <= ends_on`.
- Días de vacaciones y otras licencias: entero entre 1 y 366. Horas de permiso: `1.5` o `3`.
- Nada se borra: las licencias se anulan con motivo.
- Colores solo por tokens semánticos; reutilizar `PageHeader`, `FilterBar`, `EmptyState`, `ErrorState`,
  `Pagination`, `ConfirmSubmit`, primitivas de `src/components/ui`.

## Foco de revisión

1. **Dos licencias que se pisan** (vacaciones que solapan otra vacación o un permiso de la misma persona)
   se rechazan con «Ya tiene una licencia en esas fechas» y no crean registro. → Verificación SQL en la
   Tarea 1.
2. **Días distintos del rango** (desde 2/12 hasta 6/12 con 3 días, por el fin de semana) se guardan tal
   como se cargan, sin recalcular. → Test en la Tarea 2 (`validateLeaveInput`) y verificación SQL en la
   Tarea 1.
3. **Usuario de farmacia o de compras que entra a `/personal` por URL** vuelve al inicio, y la base no le
   devuelve filas de `staff_*`. → Verificación SQL en la Tarea 1.
4. **Importación con nombres ambiguos** («PEREZ LAURA» repetido, «ROMERO MARTIN» sin apellido claro)
   no escribe en la base: va al listado de revisión. → Test en la Tarea 6 (`splitPlanillaName`,
   `findDuplicates`).
5. **Anular una licencia ya anulada** o editar una licencia anulada se rechaza sin tocar el registro
   original. → Verificación SQL en la Tarea 1.

---

## Mapa de archivos

- Create: `supabase/migrations/202611260001_staff.sql`
- Create: `supabase/checks/personal.sql`
- Create: `src/lib/staff.ts` (constantes, tipos, Zod, normalización)
- Create: `src/app/staff-actions.ts`
- Create: `src/app/(app)/(admin)/personal/page.tsx`, `[id]/page.tsx`
- Create: `src/components/staff/` (listado, ficha, formulario de persona, formulario de licencia)
- Modify: `src/lib/navigation.ts` (ítem "Gestión de personal" en `adminNavigation`)
- Modify: `src/lib/request-management.ts` (`rpcErrorCodes`), `src/lib/feedback.ts`
- Create: `scripts/import-personal-planilla.ts` (one-off, no se ejecuta sin autorización)
- Test: `tests/staff.test.ts`, `tests/navigation.test.ts` (si no existe, se agrega el caso a un archivo
  existente de navegación), `tests/staff-import.test.ts`

---

### Tarea 1: Migración y verificación SQL

**Files:**
- Create: `supabase/migrations/202611260001_staff.sql`
- Create: `supabase/checks/personal.sql`

**Interfaces:**
- Consumes: `public.profiles(user_id)`, `public.health_centers(id)`, `public.current_app_role()`,
  `audit_events` (existentes).
- Produces: tablas `staff_members`, `staff_member_health_centers`, `staff_leaves`; RPCs
  `staff_create_member(p_first_name text, p_last_name text, p_details jsonb, p_health_center_ids uuid[]) returns uuid`,
  `staff_update_member(p_id uuid, p_first_name text, p_last_name text, p_details jsonb, p_health_center_ids uuid[]) returns void`,
  `staff_register_leave(p_staff_member_id uuid, p_kind text, p_starts_on date, p_ends_on date, p_days integer, p_hours numeric, p_note text, p_comment text) returns uuid`,
  `staff_void_leave(p_id uuid, p_reason text) returns void`.

- [ ] **Step 1: Escribir las verificaciones SQL primero**

En `supabase/checks/personal.sql` (autocontenido, con `begin` y `rollback`): crear un admin de prueba
ficticio, y comprobar:
- un solapamiento de vacaciones falla con `Ya tiene una licencia en esas fechas`;
- un permiso de 2 hs falla (solo 1,5 o 3);
- `days` distinto del rango se acepta;
- un usuario `requester` no puede llamar a `staff_register_leave` ni leer `staff_leaves`;
- anular dos veces falla y la licencia original no cambia;
- cada alta, edición y anulación deja una fila en `audit_events`.

Run: en el SQL Editor local (`npx supabase start`), pegar el archivo.
Expected: todas las comprobaciones dan `ok`; ninguna deja filas (rollback).

- [ ] **Step 2: Escribir la migración**

Tablas con los `check` del diseño (`kind` en `vacation | hours_permit | other`; `hours in (1.5, 3)` solo
en permisos; `days` solo en vacaciones y otras; `note` obligatoria en `other`; `comment` opcional). RLS
habilitado, con `select` y `all` solo si `current_app_role() = 'admin'`. Las RPCs validan de nuevo los
mismos límites y el solapamiento, con `for update` sobre la persona, y escriben `audit_events`.

- [ ] **Step 3: Aplicar en local y correr la verificación**

Run: `npx supabase db reset` y luego el check de Step 1.
Expected: migración aplicada sin error; check todo `ok`.

- [ ] **Step 4: Commit (solo con permiso del usuario)**

```bash
git add supabase/migrations/202611260001_staff.sql supabase/checks/personal.sql
git commit -m "feat(personal): tablas, RLS y RPCs de gestión de personal"
```

---

### Tarea 2: Lógica de dominio en TypeScript

**Files:**
- Create: `src/lib/staff.ts`
- Test: `tests/staff.test.ts`

**Interfaces:**
- Consumes: límites de la Tarea 1 (mismos valores).
- Produces: `staffMemberSchema`, `staffLeaveSchema` (Zod 4),
  `validateLeaveInput(input): {ok: true} | {ok: false, code: string}`,
  `normalizeName(value: string): string` (colapsa espacios, `btrim`),
  `leaveKindLabels: Record<LeaveKind, string>`, `type LeaveKind = 'vacation' | 'hours_permit' | 'other'`.

- [ ] **Step 1: Test que falla**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeName, validateLeaveInput } from '@/lib/staff'

describe('validateLeaveInput', () => {
  it('acepta días distintos del rango (fin de semana incluido)', () => {
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-02', endsOn: '2026-12-06', days: 3 })).toEqual({ ok: true })
  })
  it('rechaza permiso de 2 hs', () => {
    expect(validateLeaveInput({ kind: 'hours_permit', startsOn: '2026-12-02', endsOn: '2026-12-02', hours: 2 }))
      .toEqual({ ok: false, code: 'staff_invalid_hours' })
  })
  it('rechaza fin anterior al inicio', () => {
    expect(validateLeaveInput({ kind: 'vacation', startsOn: '2026-12-06', endsOn: '2026-12-02', days: 3 }))
      .toEqual({ ok: false, code: 'staff_invalid_range' })
  })
  it('exige nota en "otra licencia"', () => {
    expect(validateLeaveInput({ kind: 'other', startsOn: '2026-12-02', endsOn: '2026-12-02', days: 1, note: '  ' }))
      .toEqual({ ok: false, code: 'staff_note_required' })
  })
})

describe('normalizeName', () => {
  it('colapsa espacios y quita bordes', () => {
    expect(normalizeName('  RIOS   LUCIA ')).toBe('RIOS LUCIA')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/staff.test.ts`
Expected: FAIL, `Cannot find module '@/lib/staff'`.

- [ ] **Step 3: Implementar `src/lib/staff.ts`**

Los códigos de error son los de `rpcErrorCodes` (Tarea 3). `validateLeaveInput` replica las reglas de la
base: solo valida forma, el solapamiento es responsabilidad de la RPC.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/staff.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit (solo con permiso)**

```bash
git commit -m "feat(personal): validación y normalización de licencias"
```

---

### Tarea 3: Códigos de error y feedback

**Files:**
- Modify: `src/lib/request-management.ts` (`rpcErrorCodes`)
- Modify: `src/lib/feedback.ts`
- Test: `tests/feedback.test.ts` (agregar casos)

**Interfaces:**
- Consumes: códigos de la Tarea 1 (`staff_overlap`, `staff_invalid_range`, `staff_invalid_hours`,
  `staff_note_required`, `staff_not_found`, `staff_already_voided`, `staff_forbidden`).
- Produces: mensajes en español para cada código, y `managementErrorCode()` que los traduce.

- [ ] **Step 1: Test que falla**

Agregar a `tests/feedback.test.ts` un caso por código: el código de RPC se traduce a su código de
feedback, y `staff_overlap` da «Ya tiene una licencia en esas fechas».

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/feedback.test.ts`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implementar la traducción y los mensajes**

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/feedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (solo con permiso)**

```bash
git commit -m "feat(personal): códigos de error y mensajes de feedback"
```

---

### Tarea 4: Server actions

**Files:**
- Create: `src/app/staff-actions.ts`

**Interfaces:**
- Consumes: RPCs de la Tarea 1; `staffMemberSchema`, `staffLeaveSchema` de la Tarea 2; `requireRole`
  de `src/lib/session.ts`.
- Produces: `createStaffMember`, `updateStaffMember`, `registerStaffLeave`, `voidStaffLeave`, cada una
  con guard `requireRole('admin')` al inicio y redirección con `withFeedback`.

- [ ] **Step 1: Implementar cada acción**

Cada acción: `requireRole('admin')`, parseo con Zod, llamada a la RPC, traducción de error con
`managementErrorCode()`, redirección con `?error=` o `?success=`. No se testea contra Supabase real: la
verificación es la de la Tarea 1 y la revisión manual en la Tarea 5.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 3: Commit (solo con permiso)**

```bash
git commit -m "feat(personal): server actions con guard de admin"
```

---

### Tarea 5: Pantallas y menú

**Files:**
- Modify: `src/lib/navigation.ts` (ítem `{ href: '/personal', label: 'Gestión de personal', icon: Users }`
  en `adminNavigation`, después de "Usuarios")
- Create: `src/app/(app)/(admin)/personal/page.tsx`, `src/app/(app)/(admin)/personal/[id]/page.tsx`
- Create: `src/components/staff/staff-list.tsx`, `staff-profile.tsx`, `staff-form.tsx`,
  `leave-form.tsx`
- Test: `tests/navigation.test.ts` (o el archivo de navegación que exista): «Gestión de personal» está en
  `adminNavigation` y no en `requesterNavigation`.

**Interfaces:**
- Consumes: acciones de la Tarea 4.
- Produces: `/personal` (listado con nombre, apellido, CAPS, búsqueda sin acentos, filtro por CAPS,
  selector de fecha «De licencia en la fecha»), `/personal/[id]` (ficha con datos personales, CAPS,
  historial con anulados marcados, botón «Registrar licencia»).

- [ ] **Step 1: Test de navegación que falla**
- [ ] **Step 2: Agregar el ítem en `navigation.ts` y verificar que pasa**

Run: `npx vitest run` (el archivo de navegación)
Expected: PASS.

- [ ] **Step 3: Páginas y componentes**

Reglas de la spec: el listado no muestra datos personales (ni DNI, teléfono, dirección, email, fechas de
nacimiento e ingreso). Solo la ficha los muestra. Formulario de licencia: vacaciones con desde, hasta y
días como campos separados; permiso con fecha y horas (1,5 o 3); otra con rango y nota obligatoria.

- [ ] **Step 4: Verificación manual en `develop` con datos ficticios**

Run: `npm run dev`, entrar con el usuario admin de prueba y recorrer: crear persona sin datos extra,
cargar vacaciones con 3 días en un rango de 5, intentar solapar (debe rechazar), anular, abrir
`/personal` como admin y como solicitante (debe volver al inicio).
Expected: cada paso como se describe; no se usa ningún dato real.

- [ ] **Step 5: Lint, typecheck y tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: sin errores.

- [ ] **Step 6: Commit (solo con permiso)**

```bash
git commit -m "feat(personal): pantallas de personal y ítem de menú"
```

---

### Tarea 6: Script de importación (one-off)

**Files:**
- Create: `scripts/import-personal-planilla.ts`
- Test: `tests/staff-import.test.ts`

**Interfaces:**
- Consumes: el xlsx de la planilla (`Hoja 1`); `normalizeName`, `validateLeaveInput` de la Tarea 2.
- Produces: `splitPlanillaName(raw: string): {firstName, lastName, ambiguous: boolean}`,
  `findDuplicates(rows): Group[]`, `interpretLicense(raw: string): {kind, ...} | {kind: 'unparsed', raw}`.
  El script escribe un listado de revisión (CSV) y no toca la base. La carga es un segundo modo que
  requiere la bandera `--apply` y la autorización del usuario para cada ejecución.

- [ ] **Step 1: Tests que fallan**

Casos: `'SOTO ANA'` → apellido SOTO, nombre ANA; `'PEREZ,LAURA'` separado por
coma; `'NUNEZ JUAN PABLO'` marcado como ambiguo; `'27/11 3HS'` → permiso de 3 hs el 27/11; `'13/11 1,5HS'`
→ permiso de 1,5 hs; `'29 AL 30 DIAS DE ESTUDIOS'` → otra, con nota original; `'18/01 REINEGRA 25/1'`
→ no interpretada (sin año, va a revisión); dos `PEREZ LAURA` → `findDuplicates` las agrupa.
- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/staff-import.test.ts`
Expected: FAIL, módulo no existe.

- [ ] **Step 3: Implementar el parser y el listado de revisión**

El script sin `--apply` solo genera `scripts/out/revision-personal.csv` (en `.gitignore`) con cada fila,
su interpretación y su estado (ok, ambiguo, duplicado, no interpretado).

- [ ] **Step 4: Correr el script contra la planilla local (sin `--apply`)**

Run: `npx tsx scripts/import-personal-planilla.ts "<ruta a la planilla>"`
Expected: listado de revisión generado; ningún dato escrito. Se muestra al usuario el resumen de
conteos (ok, ambiguos, duplicados, no interpretados) y se pide revisión.

- [ ] **Step 5: Carga a producción (solo con autorización explícita)**

Run: `npx tsx scripts/import-personal-planilla.ts "<ruta>" --apply --env production`
Solo después de que el usuario revise el listado y autorice esta ejecución puntual. Sin esa autorización,
no se ejecuta.

- [ ] **Step 6: Commit (solo con permiso)**

```bash
git commit -m "feat(personal): script de importación de la planilla"
```

---

## Autorrevisión

- **Cobertura del diseño:** modelo (T1), validaciones (T2), errores (T3), acciones (T4), pantallas y
  menú (T5), importación (T6), datos sensibles solo en la ficha (T5, Step 3).
- **Tipos:** `LeaveKind` y los códigos de error son los mismos en T1, T2 y T3.
- **Foco de revisión:** cada uno de los 5 puntos tiene test o verificación en su tarea.
- **Riesgos conocidos:** la importación no tiene datos de profesión ni CAPS (quedan vacíos, por diseño).
  Los nombres ambiguos dependen de revisión humana.
