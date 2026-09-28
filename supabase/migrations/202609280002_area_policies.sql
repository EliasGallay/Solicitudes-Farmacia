-- Rubros de solicitud (docs/plans/plan-rubros.md, fase 2): acceso por rubro.
-- El admin ve y administra todos los rubros. El solicitante solo ve lo de sus rubros
-- (public.profile_areas) y, para solicitudes y entregas, además lo de su centro.
-- Requiere 202609280001_areas.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- True si el usuario es admin activo o tiene el rubro asignado y su perfil está activo.
create or replace function public.has_area(requested_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and (
        p.role = 'admin'
        or exists (select 1 from public.profile_areas pa where pa.user_id = p.user_id and pa.area = requested_area)
      )
  );
$$;

revoke execute on function public.has_area(text) from public;
grant execute on function public.has_area(text) to authenticated;

grant select on public.areas, public.product_types, public.profile_areas to authenticated;
grant insert, update on public.product_types to authenticated;
grant insert, delete on public.profile_areas to authenticated;

-- Rubros y tipos: el admin ve todo; el solicitante, los de sus rubros.
create policy areas_select_allowed on public.areas
for select to authenticated
using (public.current_app_role() = 'admin' or public.has_area(key));

create policy product_types_select_allowed on public.product_types
for select to authenticated
using (public.current_app_role() = 'admin' or public.has_area(area));

create policy product_types_insert_admin on public.product_types
for insert to authenticated
with check (public.current_app_role() = 'admin');

create policy product_types_update_admin on public.product_types
for update to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

-- Rubros asignados: cada usuario ve los propios; el admin, todos. Solo el admin los asigna.
create policy profile_areas_select_allowed on public.profile_areas
for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy profile_areas_insert_admin on public.profile_areas
for insert to authenticated
with check (public.current_app_role() = 'admin');

create policy profile_areas_delete_admin on public.profile_areas
for delete to authenticated
using (public.current_app_role() = 'admin');

-- Productos: el solicitante ve solo los activos de sus rubros. Alta y edición siguen siendo del admin.
drop policy if exists products_select_allowed on public.products;
create policy products_select_allowed on public.products
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or (active = true and public.has_area(area))
);

-- Solicitudes y entregas: el solicitante ve las de su centro y de sus rubros.
drop policy if exists requests_select_allowed on public.requests;
create policy requests_select_allowed on public.requests
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or (health_center_id = public.current_health_center_id() and public.has_area(area))
);

drop policy if exists requests_insert_allowed on public.requests;
create policy requests_insert_allowed on public.requests
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_area(area)
  and (
    public.current_app_role() = 'admin'
    or health_center_id = public.current_health_center_id()
  )
);

drop policy if exists deliveries_select_allowed on public.deliveries;
create policy deliveries_select_allowed on public.deliveries
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = deliveries.request_id
      and r.health_center_id = public.current_health_center_id()
      and public.has_area(r.area)
  )
);

-- Defensa en la base: un ítem solo puede ser de un producto del mismo rubro que la solicitud,
-- aunque se inserte fuera de la RPC. security definer para ver productos y solicitudes sin RLS.
create or replace function public.check_request_item_area()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.requests r
    join public.products p on p.area = r.area
    where r.id = new.request_id and p.id = new.product_id
  ) then
    raise exception 'El producto no pertenece al rubro de la solicitud';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_request_item_area() from public;

create trigger request_items_check_area
before insert or update of request_id, product_id on public.request_items
for each row execute function public.check_request_item_area();

-- La RPC recibe el rubro: rechaza si el usuario no lo tiene, si está inactivo o si algún producto
-- es de otro rubro. Se elimina la versión anterior para no dejar sobrecargas ambiguas en PostgREST.
drop function if exists public.create_request_with_items(uuid, jsonb, text);

create or replace function public.create_request_with_items(
  requested_area text,
  requested_health_center_id uuid,
  requested_items jsonb,
  requested_observations text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_request_id uuid;
  item jsonb;
  selected_product_id uuid;
  selected_quantity integer;
  target_health_center_id uuid;
begin
  if public.current_app_role() is null then
    raise exception 'Usuario inactivo o sin perfil';
  end if;

  if not public.has_area(requested_area) then
    raise exception 'Rubro no habilitado para el usuario';
  end if;

  if not exists (select 1 from public.areas where key = requested_area and active = true) then
    raise exception 'Rubro inválido o inactivo';
  end if;

  target_health_center_id := case
    when public.current_app_role() = 'admin' then requested_health_center_id
    else public.current_health_center_id()
  end;

  if target_health_center_id is null then
    raise exception 'Centro de salud requerido';
  end if;

  insert into public.requests (area, health_center_id, created_by, observations)
  values (requested_area, target_health_center_id, auth.uid(), nullif(btrim(requested_observations), ''))
  returning id into new_request_id;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    selected_product_id := (item->>'product_id')::uuid;
    selected_quantity := (item->>'quantity')::integer;

    if selected_quantity is null or selected_quantity <= 0 then
      raise exception 'La cantidad debe ser un entero positivo';
    end if;

    if not exists (
      select 1 from public.products
      where id = selected_product_id and active = true and area = requested_area
    ) then
      raise exception 'Producto inválido, inactivo o de otro rubro';
    end if;

    insert into public.request_items (request_id, product_id, requested_quantity)
    values (new_request_id, selected_product_id, selected_quantity);
  end loop;

  if not exists (select 1 from public.request_items where request_id = new_request_id) then
    raise exception 'La solicitud debe tener al menos un producto';
  end if;

  return new_request_id;
end;
$$;

revoke execute on function public.create_request_with_items(text, uuid, jsonb, text) from public;
grant execute on function public.create_request_with_items(text, uuid, jsonb, text) to authenticated;

-- Con la RPC recibiendo el rubro, toda solicitud nueva debe declararlo.
alter table public.requests alter column area drop default;

notify pgrst, 'reload schema';
