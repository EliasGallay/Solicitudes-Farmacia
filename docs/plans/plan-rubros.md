# Plan — Rubros de solicitud (farmacia, limpieza, laboratorio)

Estado al 2026-09-28, rama base `develop`. **Hecho**: fases 1 a 3.
Objetivo: ampliar el sistema de solicitudes de farmacia a otros rubros, con permisos por
rubro que se puedan combinar por persona. Se resuelve por fases, en orden, y cada fase se
mergea por separado sin romper lo existente. Marcar cada ítem al cerrarlo e indicar la
decisión tomada.

## 0. Situación actual

- Rol global en `profiles.role` (`app_role`: `admin` | `pharmacist`). El farmacéutico está
  atado a un centro (`pharmacist_center_required`); el admin no tiene centro.
- Todo el catálogo y todas las solicitudes son implícitamente de farmacia.
- `products.product_type` es un enum fijo (`medication`, `disposable`, `equipment`) con
  labels en `src/lib/product-types.ts`.
- Guards de rol centralizados en `src/lib/session.ts` (`requireSession`, `requireRole`) y
  route group `(app)/(admin)`.
- RLS basada en `current_app_role()` y `current_health_center_id()`.

## 1. Decisiones tomadas

- [x] **1.1 Administrador.** Hay un único administrador global. No hay superadmin ni admins
  por rubro. El admin ve y administra todos los rubros sin necesitar áreas asignadas.
- [x] **1.2 Permisos por rubro.** Los rubros se asignan por separado a cada solicitante y se
  combinan: una persona puede tener farmacia, limpieza, ambas, etc.
- [x] **1.3 Una solicitud, un rubro.** Una solicitud no mezcla rubros. Si alguien necesita
  farmacia y limpieza, hace dos solicitudes. La regla se valida en la base, no solo en la UI.
- [x] **1.4 Producto común.** Todos los rubros comparten el núcleo: nombre, tipo y cantidad en
  unidades. Los tipos dependen del rubro. Si un rubro necesita atributos propios, se agrega
  una tabla de extensión por rubro sin tocar el núcleo.
- [x] **1.5 Rol separado del rubro.** El rol dice *qué* puede hacer una persona
  (`admin` | `requester`); las áreas dicen *sobre qué rubros*. `pharmacist` se renombra a
  `requester`.

## 2. Modelo de datos

```sql
create table public.areas (
  key text primary key,            -- 'pharmacy', 'cleaning', 'laboratory'
  name text not null,
  active boolean not null default true
);

-- Permisos combinables: una fila por rubro habilitado. Solo para solicitantes.
create table public.profile_areas (
  user_id uuid references public.profiles(user_id) on delete cascade,
  area text references public.areas(key),
  primary key (user_id, area)
);

-- Tipos por rubro: reemplaza al enum product_type.
create table public.product_types (
  area text references public.areas(key),
  key text,
  label text not null,
  active boolean not null default true,
  primary key (area, key)
);

alter table public.products add column area text references public.areas(key);
-- FK compuesta (area, product_type) → product_types(area, key): un producto de limpieza
-- no puede tener un tipo de farmacia.

alter table public.requests add column area text references public.areas(key);
```

Notas:
- La unicidad de productos pasa de `(name, presentation)` a `(area, name, presentation)`.
- Un índice `requests (area, health_center_id, created_at desc)` reemplaza al actual para
  los listados filtrados por rubro.

## 3. Fases

### Fase 1 — Migración de datos (sin cambio visible)

- [x] 1.1 Crear `areas` y cargar `pharmacy`. `cleaning` y `laboratory` se cargan en la fase 5.
  Migración `202609280001_areas.sql`. Las claves de rubro y de tipo se validan con
  `^[a-z][a-z0-9_]*$`.
- [x] 1.2 Crear `product_types` y cargar los tres tipos actuales bajo `pharmacy`.
- [x] 1.3 `products`: agregar `area`, backfill a `pharmacy`, `not null`. Pasar
  `product_type` de enum a `text` con la FK compuesta. Eliminar el enum `product_type`.
  Decisión: `products.area` sin default; la app lo envía explícito (`'pharmacy'` hasta la fase 4).
  La unicidad pasa a `(area, name, presentation)`; los seeds se actualizaron.
- [x] 1.4 `requests`: agregar `area`, backfill a `pharmacy`, `not null`.
  Decisión: default transitorio `'pharmacy'` porque la RPC todavía no recibe el rubro; se
  elimina en la fase 2. El índice `(area, health_center_id, created_at desc)` reemplaza al anterior.
- [x] 1.5 Crear `profile_areas` y asignar `pharmacy` a todos los perfiles `pharmacist`.
- [x] 1.6 Renombrar el valor `pharmacist` → `requester` del enum `app_role` y ajustar el
  constraint `pharmacist_center_required` (renombrar a `requester_center_required`).
- [x] 1.7 Actualizar `AppRole` en `session.ts` y los usos de `'pharmacist'` en la app.

Al cerrar esta fase la app funciona igual que antes.

### Fase 2 — RLS y RPC

- [x] 2.1 Función `has_area(area text)`: true si el usuario es admin activo o tiene esa área
  en `profile_areas` (y el perfil está activo). `security definer`, como las actuales.
- [x] 2.2 `products` select: el solicitante ve solo los activos de sus áreas. Insert y
  update siguen siendo solo del admin.
- [x] 2.3 `product_types` y `areas` select: el admin ve todo; el solicitante, las de sus
  áreas. El admin además puede crear y editar tipos (para la gestión de la fase 4).
- [x] 2.4 `requests` y `deliveries` select: el solicitante ve las de su centro **y** de sus
  áreas.
- [x] 2.5 `profile_areas` select: cada usuario ve las propias; el admin, todas. Escritura
  solo del admin (insert y delete).
- [x] 2.6 `create_request_with_items(area, health_center_id, items, observations)`: rechaza
  si el usuario no tiene el área o si algún producto pertenece a otra área.
  Decisión: también rechaza un rubro inactivo (`areas.active = false`): desactivar un rubro corta
  las solicitudes nuevas sin ocultar el historial. Se elimina el default transitorio de
  `requests.area`; la app envía `'pharmacy'` hasta la fase 3.
- [x] 2.7 Trigger o check en `request_items` que impida insertar un producto de otra área
  que la de la solicitud (defensa por si se inserta fuera de la RPC).
  Trigger `request_items_check_area` (`security definer`). Migración `202609280002_area_policies.sql`.

### Fase 3 — Sesión y guards en la app

- [x] 3.1 `getSession()` devuelve `areas: AreaKey[]` (vacío para el admin, que usa `role`).
- [x] 3.2 Guard `requireArea(area)` en `session.ts`: admin pasa siempre; solicitante solo con
  el área asignada. Redirige a `/` con el aviso `sin-rubro`.
- [x] 3.3 `request-actions.ts`: `submitRequest` recibe el área, valida con `requireArea` y
  la pasa a la RPC.
- [x] 3.4 `src/lib/product-types.ts`: los tipos se leen de la base por área en lugar de una
  constante; los labels salen de `product_types.label`.
  Decisión: los listados embeben el label (`type:product_types(label)`, por la FK compuesta) y los
  filtros y formularios usan `getProductTypes()` de `src/lib/areas.ts`, junto con `getAreas()`.
  Hasta la fase 4 el wizard usa el único rubro visible y `/catalogos` los tipos de `pharmacy`.

### Fase 4 — UI

- [ ] 4.1 **Nueva solicitud**: con una sola área el wizard no cambia. Con varias, paso
  previo para elegir el rubro; el catálogo del paso de productos se filtra por esa área.
- [ ] 4.2 **Listados de solicitudes**: filtro por área, visible solo si el usuario tiene más
  de una (o es admin). Badge de rubro en cada fila cuando hay más de una.
- [ ] 4.3 **Catálogo del solicitante** (`/catalogo`): filtro por área con la misma regla.
- [ ] 4.4 **Catálogos del admin** (`/catalogos`): área en el formulario de producto; el
  selector de tipo depende del área elegida. Gestión de tipos por área.
- [ ] 4.5 **Usuarios** (`/usuarios`, cuando se implemente): checkboxes de áreas por
  solicitante.
- [ ] 4.6 **Textos**: revisar lo que hoy dice "farmacia" o "farmacéutica" y volverlo genérico
  o dependiente del área (inicio, sidebar, wizard, `UI-SPEC.md`).

### Fase 5 — Alta de rubros nuevos

- [ ] 5.1 Cargar `cleaning` y sus tipos.
- [ ] 5.2 Cargar `laboratory` y sus tipos.
- [ ] 5.3 Asignar áreas a los solicitantes que correspondan.

Solo carga de datos: no requiere cambios de código si las fases 1–4 están cerradas.

## 4. Pendientes a definir

- [ ] Tipos concretos de limpieza y laboratorio.
- [ ] Si algún rubro necesita atributos propios además de nombre, tipo y presentación
  (definiría una tabla de extensión por rubro).
- [ ] Si las entregas de cada rubro las registra el admin o, en el futuro, un responsable
  de depósito por rubro (hoy no aplica: el admin es único).
