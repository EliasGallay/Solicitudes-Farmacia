-- Prueba de integración de las notificaciones:
--   supabase/migrations/202610080001_notifications.sql
-- (docs/plans/plan-notificaciones.md).
--
-- Correr en el SQL Editor del proyecto de desarrollo DESPUÉS de aplicar la migración.
-- Todo ocurre dentro de una transacción que termina en ROLLBACK: no deja datos.
-- Si algo falla, se corta con "FALLO: ..."; si todo pasa, muestra "OK: ..." en los mensajes.
--
-- Necesita en la base: un admin activo y un solicitante activo con un rubro asignado que tenga al
-- menos 1 producto activo (los mismos datos que request_management_test.sql).

begin;

do $$
declare
  admin_id uuid;
  requester_id uuid;
  center_id uuid;
  area_key text;
  product_a uuid;
  req_id uuid;
  item_a uuid;
  delivery_1 uuid;
  delivery_2 uuid;
  line_1 uuid;
  line_2 uuid;
  marked integer;
begin
  select user_id into admin_id from public.profiles where role = 'admin' and active limit 1;
  select p.user_id, p.health_center_id, pa.area into requester_id, center_id, area_key
  from public.profiles p
  join public.profile_areas pa on pa.user_id = p.user_id
  join public.areas a on a.key = pa.area and a.active
  where p.role = 'requester' and p.active and p.health_center_id is not null
    and exists (select 1 from public.products pr where pr.area = pa.area and pr.active)
  limit 1;
  select id into product_a from public.products where area = area_key and active order by name limit 1;
  if admin_id is null or requester_id is null then
    raise exception 'FALLO: faltan datos base (admin, y solicitante con rubro y producto)';
  end if;

  -- 1. Solicitud nueva del centro: notifica al admin, no a quien la creó.
  perform set_config('request.jwt.claims', json_build_object('sub', requester_id, 'role', 'authenticated')::text, true);
  insert into public.requests (area, health_center_id, created_by) values (area_key, center_id, requester_id) returning id into req_id;
  insert into public.request_items (request_id, product_id, requested_quantity) values (req_id, product_a, 10) returning id into item_a;

  if not exists (select 1 from public.notifications where request_id = req_id and recipient_id = admin_id and kind = 'request.created') then
    raise exception 'FALLO: el admin no recibió la notificación de solicitud nueva';
  end if;
  if exists (select 1 from public.notifications where request_id = req_id and recipient_id = requester_id) then
    raise exception 'FALLO: quien creó la solicitud no debería notificarse a sí mismo';
  end if;
  raise notice 'OK: solicitud nueva → admin';

  -- 2. Entrega registrada por el admin: notifica al centro.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  delivery_1 := public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 4)), null);
  if not exists (select 1 from public.notifications where delivery_id = delivery_1 and recipient_id = requester_id and kind = 'delivery.registered') then
    raise exception 'FALLO: el centro no recibió la notificación de entrega';
  end if;
  if exists (select 1 from public.notifications where delivery_id = delivery_1 and recipient_id = admin_id) then
    raise exception 'FALLO: el admin no debería notificarse de su propia entrega';
  end if;
  raise notice 'OK: entrega registrada → centro';

  -- 3. Recepción con diferencia y conforme: ambas notifican al admin.
  perform set_config('request.jwt.claims', json_build_object('sub', requester_id, 'role', 'authenticated')::text, true);
  select id into line_1 from public.delivery_items where delivery_id = delivery_1;
  perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_1, 'received_quantity', 3, 'comment', 'faltó una caja')));
  if not exists (select 1 from public.notifications where request_id = req_id and recipient_id = admin_id and kind = 'receipt.difference') then
    raise exception 'FALLO: el admin no recibió la diferencia en la recepción';
  end if;
  raise notice 'OK: diferencia en la recepción → admin';

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  delivery_2 := public.register_delivery(req_id, jsonb_build_array(jsonb_build_object('request_item_id', item_a, 'quantity', 2)), null);
  perform set_config('request.jwt.claims', json_build_object('sub', requester_id, 'role', 'authenticated')::text, true);
  select id into line_2 from public.delivery_items where delivery_id = delivery_2;
  perform public.confirm_receipt(req_id, jsonb_build_array(jsonb_build_object('delivery_item_id', line_2, 'received_quantity', 2)));
  if not exists (select 1 from public.notifications where request_id = req_id and recipient_id = admin_id and kind = 'delivery.received') then
    raise exception 'FALLO: el admin no recibió la recepción conforme';
  end if;
  raise notice 'OK: recepción conforme → admin';

  -- Toda notificación llega a admins y centro: ninguna queda solo para una de las partes.
  if exists (
    select 1 from public.notifications n
    where n.request_id = req_id
      and n.recipient_id not in (select user_id from public.profiles where role = 'admin')
      and n.recipient_id <> requester_id
      and not exists (select 1 from public.profiles p where p.user_id = n.recipient_id and p.health_center_id = center_id)
  ) then
    raise exception 'FALLO: hay notificaciones para usuarios ajenos a la solicitud';
  end if;
  raise notice 'OK: solo admins y el centro';

  -- 4. Cada uno ve solo las suyas (RLS) y marca solo las suyas.
  set local role authenticated;
  if exists (select 1 from public.notifications where recipient_id <> requester_id) then
    raise exception 'FALLO: el solicitante ve notificaciones ajenas';
  end if;
  marked := public.mark_notifications_read(null);
  if marked < 1 or exists (select 1 from public.notifications where read_at is null) then
    raise exception 'FALLO: mark_notifications_read no marcó las propias';
  end if;
  reset role;
  if exists (select 1 from public.notifications where request_id = req_id and recipient_id = admin_id and read_at is not null) then
    raise exception 'FALLO: el solicitante marcó como leídas notificaciones del admin';
  end if;
  raise notice 'OK: RLS y marcar como leídas';
end;
$$;

rollback;
