-- Prueba de integración de la gestión de solicitudes:
--   supabase/migrations/202610020001_request_management.sql  (entregas, cierres, anulación, auditoría)
--   supabase/migrations/202610040001_delivery_receipts.sql   (confirmación de recepción)
-- (docs/plans/plan-gestion-solicitudes.md, fases 1.8 y 8).
--
-- Correr en el SQL Editor del proyecto de desarrollo DESPUÉS de aplicar las migraciones.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Si algo falla, se corta con "FALLO: ..."; si todo pasa, muestra "OK: ..." en los mensajes.
--
-- Necesita en la base: un admin activo y un solicitante activo con un rubro asignado que tenga al
-- menos 2 productos activos. La concurrencia (dos entregas simultáneas) no se puede probar en una
-- sola sesión: la cubre el `for update` sobre la solicitud en lock_request.

begin;

do $$
declare
  admin_id uuid;
  requester_id uuid;
  center_id uuid;
  area_key text;
  product_a uuid;
  product_b uuid;
  req_id uuid;
  item_a uuid;
  item_b uuid;
  delivery_1 uuid;
  delivery_2 uuid;
  line_2 uuid;
  receipt_id uuid;
  pending_a integer;
  pending_b integer;
  status text;
  audit_count integer;
begin
  select user_id into admin_id from public.profiles where role = 'admin' and active limit 1;
  select p.user_id, p.health_center_id, pa.area into requester_id, center_id, area_key
  from public.profiles p
  join public.profile_areas pa on pa.user_id = p.user_id
  join public.areas a on a.key = pa.area and a.active
  where p.role = 'requester' and p.active and p.health_center_id is not null
    and (select count(*) from public.products pr where pr.area = pa.area and pr.active) >= 2
  limit 1;
  select id into product_a from public.products where area = area_key and active order by name limit 1;
  select id into product_b from public.products where area = area_key and active and id <> product_a order by name limit 1;
  if admin_id is null or requester_id is null then
    raise exception 'FALLO: faltan datos base (admin, y solicitante con rubro de 2 productos)';
  end if;

  -- Actuar como el admin: auth.uid() lee el claim `sub`.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  insert into public.requests (area, health_center_id, created_by) values (area_key, center_id, admin_id) returning id into req_id;
  insert into public.request_items (request_id, product_id, requested_quantity) values (req_id, product_a, 10) returning id into item_a;
  insert into public.request_items (request_id, product_id, requested_quantity) values (req_id, product_b, 5) returning id into item_b;

  if not exists (select 1 from public.audit_events where entity_id = req_id and action = 'request.created') then
    raise exception 'FALLO: el alta de la solicitud no quedó auditada';
  end if;
  raise notice 'OK: alta auditada';

  -- Entrega parcial.
  delivery_1 := public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 4), jsonb_build_object('request_item_id', item_b, 'quantity', 0)), 'prueba');
  select public.pending_quantity(ri) into pending_a from public.request_items ri where ri.id = item_a;
  select public.request_status(r) into status from public.requests r where r.id = req_id;
  if pending_a <> 6 or status <> 'partial' then
    raise exception 'FALLO: tras entregar 4 se esperaba pendiente 6 y estado partial (hay % y %)', pending_a, status;
  end if;
  if (select count(*) from public.delivery_items where delivery_id = delivery_1) <> 1 then
    raise exception 'FALLO: las cantidades 0 no deberían crear líneas de entrega';
  end if;
  raise notice 'OK: entrega parcial';

  -- Sobreentrega rechazada.
  begin
    perform public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 7)), null);
    raise exception 'FALLO: se aceptó una sobreentrega';
  exception when others then
    if sqlerrm <> 'sobreentrega' then raise exception 'FALLO: se esperaba sobreentrega, llegó %', sqlerrm; end if;
  end;
  raise notice 'OK: sobreentrega rechazada';

  -- Entrega vacía rechazada.
  begin
    perform public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 0)), null);
    raise exception 'FALLO: se aceptó una entrega vacía';
  exception when others then
    if sqlerrm <> 'entrega-vacia' then raise exception 'FALLO: se esperaba entrega-vacia, llegó %', sqlerrm; end if;
  end;
  raise notice 'OK: entrega vacía rechazada';

  -- Cierre sin motivo rechazado; cierre de todo lo pendiente de B.
  begin
    perform public.close_request_items(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_b)), 'otro', '  ');
    raise exception 'FALLO: se aceptó un cierre "otro" sin detalle';
  exception when others then
    if sqlerrm <> 'motivo-requerido' then raise exception 'FALLO: se esperaba motivo-requerido, llegó %', sqlerrm; end if;
  end;
  perform public.close_request_items(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_b)), 'sin_stock', null);
  select public.pending_quantity(ri) into pending_b from public.request_items ri where ri.id = item_b;
  if pending_b <> 0 or (select closed_quantity from public.request_items where id = item_b) <> 5 then
    raise exception 'FALLO: el cierre debía dejar B con 5 cerrados y 0 pendiente';
  end if;
  raise notice 'OK: cierre con motivo';

  -- Anulación: las cantidades vuelven a pendiente; no se anula dos veces.
  perform public.void_delivery(delivery_1, 'cargada por error');
  select public.pending_quantity(ri) into pending_a from public.request_items ri where ri.id = item_a;
  if pending_a <> 10 then
    raise exception 'FALLO: tras anular, A debía volver a 10 pendientes (hay %)', pending_a;
  end if;
  begin
    perform public.void_delivery(delivery_1, 'otra vez');
    raise exception 'FALLO: se anuló dos veces la misma entrega';
  exception when others then
    if sqlerrm <> 'ya-anulada' then raise exception 'FALLO: se esperaba ya-anulada, llegó %', sqlerrm; end if;
  end;
  raise notice 'OK: anulación';

  -- Entrega total de A: queda 'completed' (entregada, falta confirmar la recepción).
  delivery_2 := public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 10)), null);
  select id into line_2 from public.delivery_items where delivery_id = delivery_2;
  select public.request_status(r) into status from public.requests r where r.id = req_id;
  if status <> 'completed' then
    raise exception 'FALLO: se esperaba completed, hay %', status;
  end if;
  raise notice 'OK: entrega total';

  -- Solo el solicitante cancela y confirma.
  begin
    perform public.cancel_request(req_id);
    raise exception 'FALLO: el admin pudo cancelar como solicitante';
  exception when others then
    if sqlerrm <> 'sin-permiso' then raise exception 'FALLO: se esperaba sin-permiso, llegó %', sqlerrm; end if;
  end;
  begin
    perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_2, 'received_quantity', 10)));
    raise exception 'FALLO: el admin pudo confirmar una recepción';
  exception when others then
    if sqlerrm <> 'sin-permiso' then raise exception 'FALLO: se esperaba sin-permiso, llegó %', sqlerrm; end if;
  end;
  raise notice 'OK: cancelación y confirmación restringidas al solicitante';

  -- Recepción como solicitante del centro: con diferencia, el comentario es obligatorio.
  perform set_config('request.jwt.claims', json_build_object('sub', requester_id, 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_2, 'received_quantity', 8)));
    raise exception 'FALLO: se aceptó una diferencia sin comentario';
  exception when others then
    if sqlerrm <> 'comentario-requerido' then raise exception 'FALLO: se esperaba comentario-requerido, llegó %', sqlerrm; end if;
  end;
  perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_2, 'received_quantity', 8, 'comment', 'faltaron 2')));
  select public.request_status(r) into status from public.requests r where r.id = req_id;
  if status <> 'completed' or (select public.receipt_discrepancy_count(r) from public.requests r where r.id = req_id) <> 1 then
    raise exception 'FALLO: con la diferencia abierta se esperaba completed y 1 diferencia (hay %)', status;
  end if;
  begin
    perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_2, 'received_quantity', 10)));
    raise exception 'FALLO: se confirmó dos veces la misma línea';
  exception when others then
    if sqlerrm <> 'ya-confirmado' then raise exception 'FALLO: se esperaba ya-confirmado, llegó %', sqlerrm; end if;
  end;
  raise notice 'OK: recepción con diferencia';

  -- El admin no puede anular una entrega confirmada; resuelve la diferencia devolviendo a pendiente.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  begin
    perform public.void_delivery(delivery_2, 'no');
    raise exception 'FALLO: se anuló una entrega con recepción confirmada';
  exception when others then
    if sqlerrm <> 'con-recepcion' then raise exception 'FALLO: se esperaba con-recepcion, llegó %', sqlerrm; end if;
  end;
  select id into receipt_id from public.delivery_item_receipts where delivery_item_id = line_2;
  perform public.resolve_receipt_difference(receipt_id, 'reenviar', 'se reenvían las 2');
  select public.pending_quantity(ri) into pending_a from public.request_items ri where ri.id = item_a;
  select public.request_status(r) into status from public.requests r where r.id = req_id;
  if pending_a <> 2 or status <> 'partial' then
    raise exception 'FALLO: tras reenviar se esperaba A con 2 pendientes y estado partial (hay % y %)', pending_a, status;
  end if;
  raise notice 'OK: diferencia resuelta (vuelve a pendiente)';

  -- Se entrega lo que faltó, el centro lo confirma completo y la solicitud queda recibida.
  perform public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 2)), null);
  perform set_config('request.jwt.claims', json_build_object('sub', requester_id, 'role', 'authenticated')::text, true);
  perform public.confirm_receipt(req_id, (
    select jsonb_agg(jsonb_build_object('delivery_item_id', di.id, 'received_quantity', di.current_quantity))
    from public.delivery_items di
    where di.request_id = req_id and di.status = 'active'
      and not exists (select 1 from public.delivery_item_receipts r where r.delivery_item_id = di.id)
  ));
  select public.request_status(r) into status from public.requests r where r.id = req_id;
  if status <> 'received' then
    raise exception 'FALLO: se esperaba received, hay %', status;
  end if;
  raise notice 'OK: solicitud recibida';

  -- Auditoría: completa e inmutable.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into audit_count from public.audit_events
    where entity_id = req_id or entity_id in (select id from public.deliveries where deliveries.request_id = req_id);
  if audit_count < 9 then
    raise exception 'FALLO: se esperaban al menos 9 eventos de auditoría (hay %)', audit_count;
  end if;
  begin
    update public.audit_events set reason = 'x' where entity_id = req_id;
    raise exception 'FALLO: se pudo modificar la auditoría';
  exception when others then
    if sqlerrm not like 'Los eventos de auditoría%' then raise exception 'FALLO: %', sqlerrm; end if;
  end;
  raise notice 'OK: auditoría completa e inmutable';

  raise notice 'OK: todas las pruebas pasaron';
end;
$$;

rollback;
