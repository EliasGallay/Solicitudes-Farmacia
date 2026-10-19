-- Entrega incorrecta al confirmar la recepción: "producto equivocado" (docs/plans/plan-ajustes-devoluciones.md,
-- punto 10). Requiere 202610040001_delivery_receipts.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Reglas:
-- - Una línea marcada como producto equivocado es una diferencia con lo recibido en 0: lo que llegó no es
--   el producto del remito. El detalle es obligatorio (qué llegó en su lugar), por la misma regla de las
--   diferencias (received_quantity < delivered_quantity).
-- - El admin la resuelve igual que cualquier diferencia: 'reenviar' (vuelve a pendiente para enviar el
--   producto correcto) o 'cerrar'. Estados, contadores y notificaciones no cambian: ya la cuentan como
--   diferencia abierta.

alter table public.delivery_item_receipts add column wrong_product boolean not null default false;
alter table public.delivery_item_receipts add constraint delivery_item_receipts_wrong_product_consistent
  check (not wrong_product or received_quantity = 0);

-- Igual que en 202610040001, con `wrong_product` opcional por línea:
-- [{delivery_item_id, received_quantity, comment, wrong_product}].
create or replace function public.confirm_receipt(target_request_id uuid, receipt_lines jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.requests;
  line jsonb;
  line_id uuid;
  received integer;
  wrong boolean;
  line_comment text;
  delivered_line public.delivery_items;
  before_quantities jsonb;
  confirmed integer := 0;
begin
  if public.current_app_role() is distinct from 'requester' then
    raise exception 'sin-permiso';
  end if;

  target := public.lock_request(target_request_id);
  if target.health_center_id is distinct from public.current_health_center_id() or not public.has_area(target.area) then
    raise exception 'solicitud-invalida';
  end if;
  if receipt_lines is null or jsonb_typeof(receipt_lines) <> 'array' or jsonb_array_length(receipt_lines) = 0 then
    raise exception 'recepcion-vacia';
  end if;

  before_quantities := public.request_quantities(target_request_id);

  for line in select * from jsonb_array_elements(receipt_lines)
  loop
    begin
      line_id := (line->>'delivery_item_id')::uuid;
      received := (line->>'received_quantity')::integer;
      wrong := coalesce((line->>'wrong_product')::boolean, false);
    exception when others then
      raise exception 'cantidad-invalida';
    end;
    line_comment := nullif(btrim(line->>'comment'), '');

    select * into delivered_line from public.delivery_items where id = line_id and request_id = target_request_id;
    if not found then
      raise exception 'item-invalido';
    end if;
    if delivered_line.status <> 'active' then
      raise exception 'entrega-anulada';
    end if;
    if exists (select 1 from public.delivery_item_receipts where delivery_item_id = line_id) then
      raise exception 'ya-confirmado';
    end if;
    if received is null or received < 0 or received > delivered_line.current_quantity then
      raise exception 'cantidad-invalida';
    end if;
    -- Producto equivocado: no llegó nada de lo entregado.
    if wrong and received <> 0 then
      raise exception 'cantidad-invalida';
    end if;
    if received < delivered_line.current_quantity and line_comment is null then
      raise exception 'comentario-requerido';
    end if;
    if line_comment is not null and length(line_comment) > 500 then
      raise exception 'nota-larga';
    end if;

    insert into public.delivery_item_receipts (request_id, delivery_item_id, delivered_quantity, received_quantity, comment, wrong_product, created_by)
    values (target_request_id, line_id, delivered_line.current_quantity, received, line_comment, wrong, auth.uid());
    confirmed := confirmed + 1;
  end loop;

  perform public.write_audit(
    'delivery.received', 'request', target_request_id, before_quantities,
    jsonb_build_object('lines', receipt_lines, 'items', public.request_quantities(target_request_id)),
    'Recepción confirmada'
  );
  return confirmed;
end;
$$;

revoke execute on function public.confirm_receipt(uuid, jsonb) from public;
grant execute on function public.confirm_receipt(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
