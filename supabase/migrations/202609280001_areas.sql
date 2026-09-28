-- Rubros de solicitud (docs/plans/plan-rubros.md, fase 1): migración de datos sin cambio visible.
-- Todo lo existente queda bajo el rubro 'pharmacy'. Las políticas de las tablas nuevas se agregan
-- en la fase 2; hasta entonces el acceso desde la API queda denegado (RLS sin políticas).
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- Rubros. 'cleaning' y 'laboratory' se cargan en la fase 5.
create table public.areas (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true
);

insert into public.areas (key, name) values ('pharmacy', 'Farmacia');

-- Tipos de producto por rubro: reemplaza al enum public.product_type.
create table public.product_types (
  area text not null references public.areas(key) on delete restrict,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) > 0),
  active boolean not null default true,
  primary key (area, key)
);

insert into public.product_types (area, key, label) values
  ('pharmacy', 'medication', 'Medicamento'),
  ('pharmacy', 'disposable', 'Descartable'),
  ('pharmacy', 'equipment', 'Equipamiento');

-- Productos: rubro obligatorio y tipo validado contra los tipos de ese rubro (FK compuesta).
-- Sin default: todo producto nuevo debe declarar su rubro.
alter table public.products add column area text references public.areas(key) on delete restrict;
update public.products set area = 'pharmacy';
alter table public.products alter column area set not null;

alter table public.products alter column product_type type text using product_type::text;
drop type public.product_type;
alter table public.products
  add constraint products_product_type_fkey foreign key (area, product_type)
  references public.product_types(area, key) on delete restrict;

alter table public.products drop constraint products_name_presentation_key;
alter table public.products add constraint products_area_name_presentation_key unique (area, name, presentation);

-- Solicitudes: una solicitud pertenece a un único rubro.
-- El default es transitorio: la RPC actual no conoce el rubro. La fase 2 lo elimina cuando
-- create_request_with_items recibe el rubro explícitamente.
alter table public.requests add column area text references public.areas(key) on delete restrict;
update public.requests set area = 'pharmacy';
alter table public.requests alter column area set not null;
alter table public.requests alter column area set default 'pharmacy';

drop index public.requests_health_center_id_created_at_idx;
create index on public.requests (area, health_center_id, created_at desc);

-- Rubros habilitados por solicitante, combinables. El admin no necesita filas: ve todos los rubros.
create table public.profile_areas (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  area text not null references public.areas(key) on delete restrict,
  primary key (user_id, area)
);

create index on public.profile_areas (area);

-- Rol separado del rubro: 'pharmacist' pasa a ser 'requester'. El check de centro se ajusta solo
-- (compara contra el valor del enum, no contra el texto); se renombra por claridad.
insert into public.profile_areas (user_id, area)
select user_id, 'pharmacy' from public.profiles where role = 'pharmacist';

alter type public.app_role rename value 'pharmacist' to 'requester';
alter table public.profiles rename constraint pharmacist_center_required to requester_center_required;

alter table public.areas enable row level security;
alter table public.product_types enable row level security;
alter table public.profile_areas enable row level security;
revoke all on public.areas, public.product_types, public.profile_areas from anon, authenticated;

notify pgrst, 'reload schema';
