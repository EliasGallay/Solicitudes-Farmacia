-- Observación opcional de la solicitud: se carga al confirmar (paso 2) y luego es de solo lectura.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

alter table public.requests
  add column observations text
  constraint requests_observations_check check (
    observations is null or (length(btrim(observations)) > 0 and length(observations) <= 500)
  );

-- Se reemplaza la RPC para aceptar la observación. Se elimina la versión de 2 parámetros
-- para no dejar dos sobrecargas ambiguas para PostgREST. El nuevo parámetro es opcional,
-- por lo que las llamadas existentes con 2 argumentos siguen funcionando.
drop function if exists public.create_request_with_items(uuid, jsonb);

create or replace function public.create_request_with_items(
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

  target_health_center_id := case
    when public.current_app_role() = 'admin' then requested_health_center_id
    else public.current_health_center_id()
  end;

  if target_health_center_id is null then
    raise exception 'Centro de salud requerido';
  end if;

  insert into public.requests (health_center_id, created_by, observations)
  values (target_health_center_id, auth.uid(), nullif(btrim(requested_observations), ''))
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

revoke execute on function public.create_request_with_items(uuid, jsonb, text) from public;
grant execute on function public.create_request_with_items(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
