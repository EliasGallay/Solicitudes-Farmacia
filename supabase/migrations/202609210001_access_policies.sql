-- Etapa 2: acceso autenticado mínimo para la aplicación remota.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active = true;
$$;

create or replace function public.current_health_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select health_center_id from public.profiles where user_id = auth.uid() and active = true;
$$;

revoke execute on function public.current_app_role() from public;
revoke execute on function public.current_health_center_id() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_health_center_id() to authenticated;

grant select on public.profiles, public.health_centers, public.products,
  public.requests, public.request_items, public.deliveries, public.delivery_items
to authenticated;
grant insert on public.requests, public.request_items to authenticated;
grant insert, update on public.products to authenticated;

create or replace function public.create_request_with_items(
  requested_health_center_id uuid,
  requested_items jsonb
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

  target_health_center_id := case
    when public.current_app_role() = 'admin' then requested_health_center_id
    else public.current_health_center_id()
  end;

  if target_health_center_id is null then
    raise exception 'Centro de salud requerido';
  end if;

  insert into public.requests (health_center_id, created_by)
  values (target_health_center_id, auth.uid())
  returning id into new_request_id;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    selected_product_id := (item->>'product_id')::uuid;
    selected_quantity := (item->>'quantity')::integer;

    if selected_quantity is null or selected_quantity <= 0 then
      raise exception 'La cantidad debe ser un entero positivo';
    end if;

    if not exists (select 1 from public.products where id = selected_product_id and active = true) then
      raise exception 'Producto inválido o inactivo';
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

revoke execute on function public.create_request_with_items(uuid, jsonb) from public;
grant execute on function public.create_request_with_items(uuid, jsonb) to authenticated;

create or replace function public.complete_password_change()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where user_id = auth.uid();
$$;

revoke execute on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists health_centers_select_allowed on public.health_centers;
create policy health_centers_select_allowed on public.health_centers
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or (active = true and id = public.current_health_center_id())
);

drop policy if exists products_select_allowed on public.products;
create policy products_select_allowed on public.products
for select to authenticated
using (
  active = true
  or public.current_app_role() = 'admin'
);

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products
for insert to authenticated
with check (public.current_app_role() = 'admin');

drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products
for update to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists requests_select_allowed on public.requests;
create policy requests_select_allowed on public.requests
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or health_center_id = public.current_health_center_id()
);

drop policy if exists requests_insert_allowed on public.requests;
create policy requests_insert_allowed on public.requests
for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.current_app_role() = 'admin'
    or health_center_id = public.current_health_center_id()
  )
);

drop policy if exists request_items_select_allowed on public.request_items;
create policy request_items_select_allowed on public.request_items
for select to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = request_items.request_id
  )
);

drop policy if exists request_items_insert_allowed on public.request_items;
create policy request_items_insert_allowed on public.request_items
for insert to authenticated
with check (
  exists (
    select 1 from public.requests r
    where r.id = request_items.request_id
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
  )
);

drop policy if exists delivery_items_select_allowed on public.delivery_items;
create policy delivery_items_select_allowed on public.delivery_items
for select to authenticated
using (
  exists (
    select 1 from public.deliveries d
    where d.id = delivery_items.delivery_id
  )
);
