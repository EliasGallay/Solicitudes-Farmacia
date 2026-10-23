-- Corrección de solicitudes por el admin (docs/plans/plan-ajustes-devoluciones.md, ítem 19): mientras
-- la solicitud tenga pendiente, el admin cambia cantidades solicitadas y agrega productos del mismo
-- rubro, con motivo obligatorio. Nada se borra: cada cambio queda en request_item_edits (historial
-- de la solicitud, visible también para el centro) y en audit_events ('request.edited').
-- Sin notificación al centro.
-- Requiere 202610210003_void_closures.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- 1. Datos ---------------------------------------------------------------------------------------

-- Una fila por producto cambiado; una corrección inserta todas sus filas con la misma fecha y autor
-- (el historial las agrupa). `previous_quantity` null: producto agregado en la corrección.
create table public.request_item_edits (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  request_item_id uuid not null,
  previous_quantity integer check (previous_quantity is null or previous_quantity > 0),
  new_quantity integer not null check (new_quantity > 0),
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (request_item_id, request_id) references public.request_items(id, request_id) on delete restrict,
  check (previous_quantity is distinct from new_quantity)
);

create index on public.request_item_edits (request_id, created_at);

-- Solo lectura: se escribe con edit_request_items.
alter table public.request_item_edits enable row level security;
grant select on public.request_item_edits to authenticated;

-- Mismo criterio que request_item_closures.
create policy request_item_edits_select_allowed on public.request_item_edits
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = request_item_edits.request_id
      and r.health_center_id = public.current_health_center_id()
      and public.has_area(r.area)
  )
);

-- 2. RPC -----------------------------------------------------------------------------------------

-- Corrige una solicitud. `item_changes`:
--   [{request_item_id, quantity}]: nueva cantidad solicitada de un producto de la solicitud; no puede
--     bajar de lo ya entregado + cerrado (lo demás sigue igual);
--   [{product_id, quantity}]:      producto agregado, activo y del rubro de la solicitud.
-- Los productos sin cambios se ignoran. Devuelve cuántos productos cambiaron.
create or replace function public.edit_request_items(target_request_id uuid, item_changes jsonb, edit_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.requests;
  clean_reason text := nullif(btrim(edit_reason), '');
  before_quantities jsonb;
  element jsonb;
  parsed_item_id uuid;
  parsed_product_id uuid;
  parsed_quantity integer;
  item public.request_items;
  item_floor integer;
  seen uuid[] := '{}';
  changes jsonb := '[]'::jsonb;
  edited_count integer := 0;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  if clean_reason is null then
    raise exception 'motivo-requerido';
  end if;
  if length(clean_reason) > 500 then
    raise exception 'nota-larga';
  end if;
  if item_changes is null or jsonb_typeof(item_changes) <> 'array' then
    raise exception 'item-invalido';
  end if;

  target := public.lock_request(target_request_id);
  if public.total_pending_quantity(target) = 0 then
    raise exception 'edicion-sin-pendiente';
  end if;
  before_quantities := public.request_quantities(target_request_id);

  for element in select * from jsonb_array_elements(item_changes)
  loop
    begin
      parsed_item_id := (element->>'request_item_id')::uuid;
      parsed_product_id := (element->>'product_id')::uuid;
      parsed_quantity := (element->>'quantity')::integer;
    exception when others then
      raise exception 'cantidad-invalida';
    end;
    if parsed_quantity is null or parsed_quantity <= 0 then
      raise exception 'cantidad-invalida';
    end if;
    if (parsed_item_id is null) = (parsed_product_id is null) then
      raise exception 'item-invalido';
    end if;

    if parsed_item_id is not null then
      -- Cambio de cantidad de un producto de la solicitud.
      if parsed_item_id = any(seen) then
        raise exception 'item-invalido';
      end if;
      seen := seen || parsed_item_id;

      select * into item from public.request_items ri where ri.id = parsed_item_id and ri.request_id = target_request_id;
      if not found then
        raise exception 'item-invalido';
      end if;
      item_floor := public.delivered_quantity(item) + item.closed_quantity;
      if parsed_quantity < item_floor then
        raise exception 'cantidad-menor-entregado';
      end if;
      if parsed_quantity = item.requested_quantity then
        continue;
      end if;

      update public.request_items set requested_quantity = parsed_quantity where id = item.id;
      insert into public.request_item_edits (request_id, request_item_id, previous_quantity, new_quantity, reason, created_by)
      values (target_request_id, item.id, item.requested_quantity, parsed_quantity, clean_reason, auth.uid());
      changes := changes || jsonb_build_object('request_item_id', item.id, 'product_id', item.product_id, 'before', item.requested_quantity, 'after', parsed_quantity);
    else
      -- Producto agregado.
      if parsed_product_id = any(seen) then
        raise exception 'item-invalido';
      end if;
      seen := seen || parsed_product_id;

      if not exists (select 1 from public.products p where p.id = parsed_product_id and p.active and p.area = target.area) then
        raise exception 'producto-invalido';
      end if;
      if exists (select 1 from public.request_items ri where ri.request_id = target_request_id and ri.product_id = parsed_product_id) then
        raise exception 'producto-repetido';
      end if;

      insert into public.request_items (request_id, product_id, requested_quantity)
      values (target_request_id, parsed_product_id, parsed_quantity)
      returning * into item;
      insert into public.request_item_edits (request_id, request_item_id, previous_quantity, new_quantity, reason, created_by)
      values (target_request_id, item.id, null, parsed_quantity, clean_reason, auth.uid());
      changes := changes || jsonb_build_object('request_item_id', item.id, 'product_id', parsed_product_id, 'before', null, 'after', parsed_quantity);
    end if;
    edited_count := edited_count + 1;
  end loop;

  if edited_count = 0 then
    raise exception 'sin-cambios';
  end if;

  perform public.write_audit(
    'request.edited', 'request', target_request_id, before_quantities,
    jsonb_build_object('request_number', target.request_number, 'changes', changes, 'items', public.request_quantities(target_request_id)),
    clean_reason
  );
  return edited_count;
end;
$$;

revoke execute on function public.edit_request_items(uuid, jsonb, text) from public;
grant execute on function public.edit_request_items(uuid, jsonb, text) to authenticated;

-- 3. Nombres del historial -----------------------------------------------------------------------

-- Igual que 202610210003, más quien corrigió la solicitud.
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
  )
  select p.user_id, p.full_name
  from public.profiles p
  join actors a on a.actor_id = p.user_id;
$$;

notify pgrst, 'reload schema';
