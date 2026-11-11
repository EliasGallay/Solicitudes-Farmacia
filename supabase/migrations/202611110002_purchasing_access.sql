-- Rol "Compras" (purchasing), parte 2: perfil, lectura de las solicitudes con requerimiento de compra y
-- comentarios en el historial de la solicitud.
-- Requiere 202611110001_purchasing_role.sql (aplicada antes, en su propia ejecución),
-- 202610210001_purchase_requirements.sql y 202610230002_signed_delivery_notes.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Compras no tiene centro ni rubros. Lee, de todos los centros y rubros, solo las solicitudes con número
-- de requerimiento de compra (aunque ya tengan entregas), con sus productos, entregas, cierres,
-- recepciones, correcciones y comentarios. No crea, entrega, cierra ni edita nada: las RPCs de gestión
-- exigen 'admin' o 'requester'. Los remitos firmados (archivos) quedan fuera.

-- 1. Perfil ---------------------------------------------------------------------------------------

alter table public.profiles drop constraint requester_center_required;
alter table public.profiles add constraint requester_center_required check (
  (role = 'requester' and health_center_id is not null)
  or (role in ('admin', 'purchasing') and health_center_id is null)
);

-- Igual que 202609300001, con Compras: sin centro ni rubros, como el admin.
create or replace function public.admin_save_user(
  target_user_id uuid,
  new_full_name text,
  new_role public.app_role,
  new_health_center_id uuid,
  new_areas text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'La cuenta no existe' using errcode = 'P0002';
  end if;

  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'No podés quitarte el rol de administrador' using errcode = '42501';
  end if;

  if new_role = 'requester' then
    if new_health_center_id is null or not exists (select 1 from public.health_centers where id = new_health_center_id) then
      raise exception 'Centro de salud requerido' using errcode = '23514';
    end if;
    if coalesce(cardinality(new_areas), 0) = 0 then
      raise exception 'El solicitante necesita al menos un rubro' using errcode = '23514';
    end if;
    if exists (select 1 from unnest(new_areas) a where not exists (select 1 from public.areas where key = a)) then
      raise exception 'Rubro inválido' using errcode = '23503';
    end if;
  end if;

  insert into public.profiles (user_id, full_name, role, health_center_id)
  values (
    target_user_id,
    btrim(new_full_name),
    new_role,
    case when new_role = 'requester' then new_health_center_id end
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      health_center_id = excluded.health_center_id;

  delete from public.profile_areas
  where user_id = target_user_id
    and (new_role <> 'requester' or area <> all(new_areas));

  if new_role = 'requester' then
    insert into public.profile_areas (user_id, area)
    select distinct target_user_id, a from unnest(new_areas) a
    on conflict do nothing;
  end if;
end;
$$;

-- 2. Lectura --------------------------------------------------------------------------------------

-- request_items y delivery_items ya filtran por la visibilidad de requests y deliveries (RLS en el exists).

-- El insert directo en request_items (lo usa create_request_with_items, security invoker) solo pedía ver
-- la solicitud: con la lectura de Compras eso le permitiría agregar productos. Se limita a los roles que
-- crean solicitudes; para el admin y el solicitante no cambia nada.
drop policy if exists request_items_insert_allowed on public.request_items;
create policy request_items_insert_allowed on public.request_items
for insert to authenticated
with check (
  public.current_app_role() in ('admin', 'requester')
  and exists (
    select 1 from public.requests r
    where r.id = request_items.request_id
  )
);

drop policy if exists requests_select_allowed on public.requests;
create policy requests_select_allowed on public.requests
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'purchasing' and purchase_requirement_number is not null)
  or (health_center_id = public.current_health_center_id() and public.has_area(area))
);

drop policy if exists deliveries_select_allowed on public.deliveries;
create policy deliveries_select_allowed on public.deliveries
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = deliveries.request_id
      and (
        (public.current_app_role() = 'purchasing' and r.purchase_requirement_number is not null)
        or (r.health_center_id = public.current_health_center_id() and public.has_area(r.area))
      )
  )
);

drop policy if exists request_item_closures_select_allowed on public.request_item_closures;
create policy request_item_closures_select_allowed on public.request_item_closures
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = request_item_closures.request_id
      and (
        (public.current_app_role() = 'purchasing' and r.purchase_requirement_number is not null)
        or (r.health_center_id = public.current_health_center_id() and public.has_area(r.area))
      )
  )
);

drop policy if exists delivery_item_receipts_select_allowed on public.delivery_item_receipts;
create policy delivery_item_receipts_select_allowed on public.delivery_item_receipts
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = delivery_item_receipts.request_id
      and (
        (public.current_app_role() = 'purchasing' and r.purchase_requirement_number is not null)
        or (r.health_center_id = public.current_health_center_id() and public.has_area(r.area))
      )
  )
);

drop policy if exists request_item_edits_select_allowed on public.request_item_edits;
create policy request_item_edits_select_allowed on public.request_item_edits
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = request_item_edits.request_id
      and (
        (public.current_app_role() = 'purchasing' and r.purchase_requirement_number is not null)
        or (r.health_center_id = public.current_health_center_id() and public.has_area(r.area))
      )
  )
);

-- Catálogos que el detalle y el listado embeben: productos (también inactivos, de solicitudes viejas),
-- tipos, rubros y centros.
drop policy if exists products_select_allowed on public.products;
create policy products_select_allowed on public.products
for select to authenticated
using (
  public.current_app_role() in ('admin', 'purchasing')
  or (active = true and public.has_area(area))
);

drop policy if exists product_types_select_allowed on public.product_types;
create policy product_types_select_allowed on public.product_types
for select to authenticated
using (public.current_app_role() in ('admin', 'purchasing') or public.has_area(area));

drop policy if exists areas_select_allowed on public.areas;
create policy areas_select_allowed on public.areas
for select to authenticated
using (public.current_app_role() in ('admin', 'purchasing') or public.has_area(key));

drop policy if exists health_centers_select_allowed on public.health_centers;
create policy health_centers_select_allowed on public.health_centers
for select to authenticated
using (
  public.current_app_role() in ('admin', 'purchasing')
  or (active = true and id = public.current_health_center_id())
);

-- 3. Comentarios ----------------------------------------------------------------------------------

-- Texto libre en el historial. Escriben el admin y Compras; los lee todo el que ve la solicitud.
-- Sin grants de escritura: se agregan solo con add_request_comment y no se editan ni se borran.
create table public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  body text not null check (length(body) between 1 and 500 and body = btrim(body)),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create index on public.request_comments (request_id, created_at);

alter table public.request_comments enable row level security;
grant select on public.request_comments to authenticated;
create policy request_comments_select_allowed on public.request_comments
for select to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = request_comments.request_id
  )
);

create or replace function public.add_request_comment(target_request_id uuid, comment_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role public.app_role := public.current_app_role();
  target public.requests;
  clean_body text := nullif(btrim(comment_body), '');
  new_comment_id uuid;
begin
  if viewer_role is null or viewer_role not in ('admin', 'purchasing') then
    raise exception 'sin-permiso';
  end if;
  if clean_body is null or length(clean_body) > 500 then
    raise exception 'comentario-invalido';
  end if;

  select * into target from public.requests where id = target_request_id;
  -- Compras solo comenta lo que puede ver: solicitudes con requerimiento de compra.
  if not found or (viewer_role = 'purchasing' and target.purchase_requirement_number is null) then
    raise exception 'solicitud-invalida';
  end if;

  insert into public.request_comments (request_id, body, created_by)
  values (target_request_id, clean_body, auth.uid())
  returning id into new_comment_id;

  perform public.write_audit(
    'request.comment', 'request', target_request_id,
    null,
    jsonb_build_object('request_number', target.request_number, 'comment_id', new_comment_id, 'body', clean_body),
    'Comentario agregado'
  );
  return new_comment_id;
end;
$$;

revoke execute on function public.add_request_comment(uuid, text) from public;
grant execute on function public.add_request_comment(uuid, text) to authenticated;

-- 4. Nombres en el historial ------------------------------------------------------------------------

-- Igual que 202610230002, con Compras entre quienes ven la solicitud y los autores de comentarios.
create or replace function public.request_actor_names(target_request_id uuid)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.id, r.created_by, r.purchase_requirement_by
    from public.requests r
    where r.id = target_request_id
      and (
        public.current_app_role() = 'admin'
        or (public.current_app_role() = 'purchasing' and r.purchase_requirement_number is not null)
        or (r.health_center_id = public.current_health_center_id() and public.has_area(r.area))
      )
  ),
  actors as (
    select v.created_by as actor_id from visible v
    union
    select v.purchase_requirement_by from visible v where v.purchase_requirement_by is not null
    union
    select d.created_by from public.deliveries d join visible v on v.id = d.request_id
    union
    select d.voided_by from public.deliveries d join visible v on v.id = d.request_id where d.voided_by is not null
    union
    select c.created_by from public.request_item_closures c join visible v on v.id = c.request_id
    union
    select c.voided_by from public.request_item_closures c join visible v on v.id = c.request_id where c.voided_by is not null
    union
    select rc.created_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id
    union
    select rc.resolved_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id where rc.resolved_by is not null
    union
    select e.created_by from public.request_item_edits e join visible v on v.id = e.request_id
    union
    select n.created_by from public.delivery_signed_notes n join visible v on v.id = n.request_id
    union
    select cm.created_by from public.request_comments cm join visible v on v.id = cm.request_id
  )
  select p.user_id, p.full_name
  from public.profiles p
  join actors a on a.actor_id = p.user_id;
$$;

notify pgrst, 'reload schema';
