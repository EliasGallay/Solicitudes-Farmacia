-- Entregas por encima de lo pedido (docs/plans/plan-ajustes-devoluciones.md, ítem 17): el admin puede
-- entregar más que el pendiente de un producto (ej. pidieron 50 y se mandan 100). Los cierres siguen
-- limitados al pendiente.
-- El pendiente nunca queda negativo: con sobreentrega es 0 y el ítem queda completo.
-- Requiere 202610210003_void_closures.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- 1. Pendiente -----------------------------------------------------------------------------------

create or replace function public.pending_quantity(item public.request_items)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select greatest(item.requested_quantity - item.closed_quantity - public.delivered_quantity(item), 0);
$$;

-- 2. Normalización de líneas ---------------------------------------------------------------------

-- Igual que en 202610020001, con `allow_excess`: si es true, una cantidad puede superar el
-- pendiente (entregas). Los cierres la llaman sin ese parámetro y siguen rechazando `sobreentrega`.
drop function public.resolve_request_items(uuid, jsonb);

create function public.resolve_request_items(target_request_id uuid, requested_items jsonb, allow_excess boolean default false)
returns table (request_item_id uuid, quantity integer, pending integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  element jsonb;
  parsed_id uuid;
  parsed_quantity integer;
  item_pending integer;
  seen uuid[] := '{}';
begin
  if requested_items is null then
    return query
      select ri.id, public.pending_quantity(ri), public.pending_quantity(ri)
      from public.request_items ri
      where ri.request_id = target_request_id and public.pending_quantity(ri) > 0;
    return;
  end if;

  if jsonb_typeof(requested_items) <> 'array' then
    raise exception 'item-invalido';
  end if;

  for element in select * from jsonb_array_elements(requested_items)
  loop
    begin
      parsed_id := (element->>'request_item_id')::uuid;
      parsed_quantity := (element->>'quantity')::integer;
    exception when others then
      raise exception 'cantidad-invalida';
    end;

    if parsed_id is null or parsed_id = any(seen) then
      raise exception 'item-invalido';
    end if;
    seen := seen || parsed_id;

    select public.pending_quantity(ri) into item_pending
    from public.request_items ri
    where ri.id = parsed_id and ri.request_id = target_request_id;
    if not found then
      raise exception 'item-invalido';
    end if;

    if not (element ? 'quantity') then
      parsed_quantity := item_pending;
    elsif parsed_quantity is null or parsed_quantity < 0 then
      raise exception 'cantidad-invalida';
    end if;

    if parsed_quantity > item_pending and not allow_excess then
      raise exception 'sobreentrega';
    end if;

    if parsed_quantity > 0 then
      request_item_id := parsed_id;
      quantity := parsed_quantity;
      pending := item_pending;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.resolve_request_items(uuid, jsonb, boolean) from public;

-- 3. Entrega -------------------------------------------------------------------------------------

-- Igual que en 202610020001, pero acepta cantidades mayores al pendiente.
create or replace function public.register_delivery(target_request_id uuid, delivery_lines jsonb, delivery_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_delivery public.deliveries;
  before_quantities jsonb;
  resolved record;
  delivered_count integer := 0;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  if delivery_lines is null then
    raise exception 'entrega-vacia';
  end if;
  if delivery_note is not null and length(delivery_note) > 500 then
    raise exception 'nota-larga';
  end if;

  perform public.lock_request(target_request_id);
  before_quantities := public.request_quantities(target_request_id);

  insert into public.deliveries (request_id, created_by, note)
  values (target_request_id, auth.uid(), nullif(btrim(delivery_note), ''))
  returning * into new_delivery;

  for resolved in select * from public.resolve_request_items(target_request_id, delivery_lines, true)
  loop
    insert into public.delivery_items (delivery_id, request_id, request_item_id, current_quantity)
    values (new_delivery.id, target_request_id, resolved.request_item_id, resolved.quantity);
    delivered_count := delivered_count + 1;
  end loop;

  if delivered_count = 0 then
    raise exception 'entrega-vacia';
  end if;

  perform public.write_audit(
    'delivery.registered', 'delivery', new_delivery.id, before_quantities,
    jsonb_build_object('request_id', target_request_id, 'delivery_number', new_delivery.delivery_number, 'items', public.request_quantities(target_request_id)),
    coalesce(new_delivery.note, 'Entrega registrada')
  );
  return new_delivery.id;
end;
$$;

-- 4. Resolución de diferencias -------------------------------------------------------------------

-- Igual que en 202610040001, pero con sobreentrega el faltante puede superar lo que queda pendiente
-- (pidieron 50, se mandaron 100, llegaron 30: faltan 70 pero solo 20 vuelven a pendiente). Al
-- cerrar se registra el cierre solo por lo que quedó pendiente, así closed_quantity no supera lo
-- solicitado.
create or replace function public.resolve_receipt_difference(target_receipt_id uuid, target_resolution text, target_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt public.delivery_item_receipts;
  clean_note text := nullif(btrim(target_note), '');
  missing integer;
  to_close integer;
  target_item_id uuid;
  before_quantities jsonb;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  if target_resolution is null or target_resolution not in ('reenviar', 'cerrar') then
    raise exception 'motivo-requerido';
  end if;
  if clean_note is not null and length(clean_note) > 500 then
    raise exception 'nota-larga';
  end if;

  select * into receipt from public.delivery_item_receipts where id = target_receipt_id;
  if not found then
    raise exception 'item-invalido';
  end if;

  perform public.lock_request(receipt.request_id);
  -- Releer con la solicitud bloqueada: otra resolución pudo terminar mientras se esperaba.
  select * into receipt from public.delivery_item_receipts where id = target_receipt_id for update;
  if receipt.resolved_at is not null then
    raise exception 'ya-resuelta';
  end if;
  if receipt.received_quantity >= receipt.delivered_quantity then
    raise exception 'sin-diferencia';
  end if;

  select request_item_id into target_item_id
  from public.delivery_items
  where id = receipt.delivery_item_id and status = 'active';
  if not found then
    raise exception 'entrega-anulada';
  end if;

  before_quantities := public.request_quantities(receipt.request_id);
  missing := receipt.delivered_quantity - receipt.received_quantity;

  update public.delivery_item_receipts
  set resolution = target_resolution, resolution_note = clean_note, resolved_by = auth.uid(), resolved_at = now()
  where id = receipt.id;

  -- Al resolver, la línea cuenta lo recibido: el faltante vuelve a pendiente (hasta lo solicitado).
  -- Si se cierra, se registra el cierre por lo que volvió a pendiente.
  if target_resolution = 'cerrar' then
    select least(missing, public.pending_quantity(ri)) into to_close
    from public.request_items ri
    where ri.id = target_item_id;

    if to_close > 0 then
      insert into public.request_item_closures (request_id, request_item_id, quantity, reason, detail, created_by)
      values (receipt.request_id, target_item_id, to_close, 'no_recibido', clean_note, auth.uid());
      update public.request_items set closed_quantity = closed_quantity + to_close where id = target_item_id;
    end if;
  end if;

  perform public.write_audit(
    'receipt.resolved', 'request', receipt.request_id, before_quantities,
    jsonb_build_object('receipt_id', receipt.id, 'resolution', target_resolution, 'missing', missing, 'items', public.request_quantities(receipt.request_id)),
    coalesce(clean_note, case when target_resolution = 'reenviar' then 'Faltante vuelve a pendiente' else 'Faltante cerrado' end)
  );
end;
$$;
