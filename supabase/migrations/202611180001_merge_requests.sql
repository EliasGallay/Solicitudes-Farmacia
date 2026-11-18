-- Unificar solicitudes (admin): pasa lo pendiente de una solicitud origen a una destino del mismo
-- centro y rubro, y cierra el origen con motivo 'duplicado'. Nada se borra: las cantidades sumadas
-- quedan en request_item_edits (historial de la destino, visible también para el centro), el cierre
-- del origen queda en request_item_closures y ambos cambios se auditan en audit_events.
-- Requiere 202610230001_request_edits.sql y 202610210003_void_closures.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.merge_requests(source_request_id uuid, target_request_id uuid, merge_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_reason text := nullif(btrim(merge_reason), '');
  from_request public.requests;
  to_request public.requests;
  source_item public.request_items;
  target_item public.request_items;
  before_quantities jsonb;
  pending_quantity integer;
  previous_quantity integer;
  changes jsonb := '[]'::jsonb;
  moved_count integer := 0;
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
  if source_request_id is null or target_request_id is null or source_request_id = target_request_id then
    raise exception 'solicitud-invalida';
  end if;

  -- Bloqueo en orden fijo para que dos unificaciones cruzadas no se traben entre sí.
  if source_request_id < target_request_id then
    from_request := public.lock_request(source_request_id);
    to_request := public.lock_request(target_request_id);
  else
    to_request := public.lock_request(target_request_id);
    from_request := public.lock_request(source_request_id);
  end if;

  if from_request.health_center_id is distinct from to_request.health_center_id or from_request.area is distinct from to_request.area then
    raise exception 'solicitud-invalida';
  end if;
  -- Solo origen sin entregas activas, igual que cancel_request: lo entregado no se mueve.
  if exists (
    select 1 from public.delivery_items di
    where di.request_id = source_request_id and di.status = 'active'
  ) then
    raise exception 'con-entregas';
  end if;
  if public.total_pending_quantity(from_request) = 0 then
    raise exception 'sin-pendiente';
  end if;
  if public.total_pending_quantity(to_request) = 0 then
    raise exception 'edicion-sin-pendiente';
  end if;

  before_quantities := public.request_quantities(target_request_id);

  for source_item in
    select * from public.request_items ri where ri.request_id = source_request_id order by ri.id
  loop
    pending_quantity := source_item.requested_quantity - public.delivered_quantity(source_item) - source_item.closed_quantity;
    if pending_quantity <= 0 then
      continue;
    end if;

    select * into target_item from public.request_items ri
    where ri.request_id = target_request_id and ri.product_id = source_item.product_id;

    if found then
      previous_quantity := target_item.requested_quantity;
      update public.request_items set requested_quantity = previous_quantity + pending_quantity where id = target_item.id;
      insert into public.request_item_edits (request_id, request_item_id, previous_quantity, new_quantity, reason, created_by)
      values (target_request_id, target_item.id, previous_quantity, previous_quantity + pending_quantity,
        left('Unificada desde ' || from_request.request_number || ': ' || clean_reason, 500), auth.uid());
    else
      insert into public.request_items (request_id, product_id, requested_quantity)
      values (target_request_id, source_item.product_id, pending_quantity)
      returning * into target_item;
      insert into public.request_item_edits (request_id, request_item_id, previous_quantity, new_quantity, reason, created_by)
      values (target_request_id, target_item.id, null, pending_quantity,
        left('Unificada desde ' || from_request.request_number || ': ' || clean_reason, 500), auth.uid());
    end if;

    changes := changes || jsonb_build_object('product_id', source_item.product_id, 'quantity', pending_quantity);
    moved_count := moved_count + 1;
  end loop;

  -- Cierra lo pendiente del origen (apply_closures audita 'items.closed' con el mismo motivo).
  perform public.apply_closures(
    source_request_id, null, 'duplicado',
    left('Unificada con ' || to_request.request_number || ': ' || clean_reason, 500)
  );

  perform public.write_audit(
    'request.merged', 'request', target_request_id, before_quantities,
    jsonb_build_object('from_request_number', from_request.request_number, 'changes', changes, 'items', public.request_quantities(target_request_id)),
    clean_reason
  );
  return moved_count;
end;
$$;

revoke execute on function public.merge_requests(uuid, uuid, text) from public;
grant execute on function public.merge_requests(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
