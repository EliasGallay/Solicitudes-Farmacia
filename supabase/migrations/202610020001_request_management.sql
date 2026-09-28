-- Gestión de solicitudes del lado del admin (docs/plans/plan-gestion-solicitudes.md, fase 1):
-- entregas con número de remito, cierres con motivo, anulación de entregas, cancelación por el
-- solicitante y auditoría escrita en la misma transacción.
-- Requiere 202609280002_area_policies.sql y 202609300001_user_admin.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Todo cambio pasa por las RPCs de este archivo: son security definer (la API no tiene insert ni
-- update sobre deliveries, delivery_items, request_item_closures ni audit_events) y cada una
-- valida el rol, bloquea la solicitud (`for update`) y revalida los saldos. Dos operaciones sobre la
-- misma solicitud se ejecutan una detrás de otra, así que no puede haber sobreentregas en paralelo.
--
-- Los errores esperables se lanzan con un código corto como mensaje (ej. 'sobreentrega'); la app los
-- traduce con src/lib/feedback.ts.

-- 1. Entregas: número de remito, nota y anulación ------------------------------------------------

-- Número de remito: secuencia global, como request_number. Se muestra como #REM-{número}.
alter table public.deliveries add column delivery_number bigint generated always as identity;
alter table public.deliveries add constraint deliveries_delivery_number_key unique (delivery_number);
alter table public.deliveries add column note text check (note is null or length(note) <= 500);
alter table public.deliveries add column voided_at timestamptz;
alter table public.deliveries add column voided_by uuid references public.profiles(user_id) on delete restrict;
alter table public.deliveries add column void_reason text check (void_reason is null or length(void_reason) <= 500);
-- Anulada ⇔ tiene fecha, autor y motivo.
alter table public.deliveries add constraint deliveries_void_consistent check (
  (voided_at is null and voided_by is null and void_reason is null)
  or (voided_at is not null and voided_by is not null and length(btrim(void_reason)) > 0)
);
create index on public.deliveries (created_at desc);

-- 2. Cierres ------------------------------------------------------------------------------------

-- Un movimiento por ítem cerrado. request_items.closed_quantity es el total acumulado y lo
-- actualiza la misma RPC, así la regla de pendiente (202609240001) no cambia.
create table public.request_item_closures (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  request_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  reason text not null check (reason in ('sin_stock', 'discontinuado', 'rechazado', 'duplicado', 'cancelada', 'otro')),
  detail text check (detail is null or length(detail) <= 500),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (request_item_id, request_id) references public.request_items(id, request_id) on delete restrict
);
create index on public.request_item_closures (request_id, created_at);

alter table public.request_item_closures enable row level security;
grant select on public.request_item_closures to authenticated;

-- Misma regla que deliveries: el admin ve todo; el solicitante, lo de su centro y sus rubros.
create policy request_item_closures_select_allowed on public.request_item_closures
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = request_item_closures.request_id
      and r.health_center_id = public.current_health_center_id()
      and public.has_area(r.area)
  )
);

-- 3. Auditoría ----------------------------------------------------------------------------------

-- Solo el admin la consulta. Nadie la modifica ni la borra: sin grants de escritura y con un
-- trigger que lo rechaza incluso para el dueño de la tabla (las RPCs security definer).
grant select on public.audit_events to authenticated;
create policy audit_events_select_admin on public.audit_events
for select to authenticated
using (public.current_app_role() = 'admin');

create index on public.audit_events (created_at desc);
create index on public.audit_events (actor_id, created_at desc);

create or replace function public.reject_audit_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los eventos de auditoría no se pueden modificar ni eliminar';
end;
$$;

revoke execute on function public.reject_audit_change() from public;

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function public.reject_audit_change();

-- Uso interno de las RPCs y triggers de este archivo: no se expone a la API.
create or replace function public.write_audit(
  audit_action text,
  audit_entity_type text,
  audit_entity_id uuid,
  audit_before jsonb,
  audit_after jsonb,
  audit_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), audit_action, audit_entity_type, audit_entity_id, audit_before, audit_after, audit_reason);
$$;

revoke execute on function public.write_audit(text, text, uuid, jsonb, jsonb, text) from public;

-- Alta de solicitud: se audita con un trigger para no reescribir create_request_with_items. Los
-- ítems se insertan después de la solicitud, así que el evento guarda los datos de cabecera.
create or replace function public.audit_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit(
    'request.created', 'request', new.id, null,
    jsonb_build_object('request_number', new.request_number, 'area', new.area, 'health_center_id', new.health_center_id, 'observations', new.observations),
    'Solicitud creada'
  );
  return new;
end;
$$;

revoke execute on function public.audit_request_created() from public;

create trigger requests_audit_created
after insert on public.requests
for each row execute function public.audit_request_created();

-- 4. Helpers internos ---------------------------------------------------------------------------

-- Bloquea la solicitud y la devuelve; toda operación de gestión empieza por acá.
create or replace function public.lock_request(target_request_id uuid)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  locked public.requests;
begin
  select * into locked from public.requests where id = target_request_id for update;
  if not found then
    raise exception 'solicitud-invalida';
  end if;
  return locked;
end;
$$;

revoke execute on function public.lock_request(uuid) from public;

-- Cantidades por ítem de una solicitud, para el antes/después de la auditoría.
create or replace function public.request_quantities(target_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'request_item_id', ri.id,
    'requested', ri.requested_quantity,
    'delivered', public.delivered_quantity(ri),
    'closed', ri.closed_quantity,
    'pending', public.pending_quantity(ri)
  ) order by ri.id), '[]'::jsonb)
  from public.request_items ri
  where ri.request_id = target_request_id;
$$;

revoke execute on function public.request_quantities(uuid) from public;

-- Normaliza la lista [{request_item_id, quantity}] de una operación: rechaza ítems ajenos a la
-- solicitud, repetidos o con cantidades inválidas, y descarta las cantidades 0.
-- Un ítem sin `quantity` toma todo su pendiente; `null` como lista, todo lo pendiente de cada ítem.
-- Se calcula con la solicitud ya bloqueada. Devuelve (ítem, cantidad, pendiente).
create or replace function public.resolve_request_items(target_request_id uuid, requested_items jsonb)
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

    if parsed_quantity > item_pending then
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

revoke execute on function public.resolve_request_items(uuid, jsonb) from public;

-- Aplica cierres ya validados por el llamador (rol y bloqueo).
create or replace function public.apply_closures(target_request_id uuid, requested_items jsonb, closure_reason text, closure_detail text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  before_quantities jsonb;
  closed_count integer := 0;
  resolved record;
begin
  before_quantities := public.request_quantities(target_request_id);

  for resolved in select * from public.resolve_request_items(target_request_id, requested_items)
  loop
    insert into public.request_item_closures (request_id, request_item_id, quantity, reason, detail, created_by)
    values (target_request_id, resolved.request_item_id, resolved.quantity, closure_reason, closure_detail, auth.uid());

    update public.request_items
    set closed_quantity = closed_quantity + resolved.quantity
    where id = resolved.request_item_id;

    closed_count := closed_count + 1;
  end loop;

  if closed_count = 0 then
    raise exception 'sin-pendiente';
  end if;

  perform public.write_audit(
    case when closure_reason = 'cancelada' then 'request.cancelled' else 'items.closed' end,
    'request', target_request_id, before_quantities, public.request_quantities(target_request_id),
    coalesce(closure_detail, closure_reason)
  );
  return closed_count;
end;
$$;

revoke execute on function public.apply_closures(uuid, jsonb, text, text) from public;

-- 5. RPCs expuestas -----------------------------------------------------------------------------

-- Registra una entrega. `delivery_lines`: [{request_item_id, quantity}] (las cantidades 0 se
-- ignoran). Devuelve el id de la entrega.
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

  for resolved in select * from public.resolve_request_items(target_request_id, delivery_lines)
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

revoke execute on function public.register_delivery(uuid, jsonb, text) from public;
grant execute on function public.register_delivery(uuid, jsonb, text) to authenticated;

-- Cierra cantidades que no se van a entregar. `closure_items` null: todo lo pendiente.
-- 'cancelada' queda reservado a cancel_request.
create or replace function public.close_request_items(target_request_id uuid, closure_items jsonb, closure_reason text, closure_detail text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_detail text := nullif(btrim(closure_detail), '');
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  if closure_reason is null or closure_reason not in ('sin_stock', 'discontinuado', 'rechazado', 'duplicado', 'otro') then
    raise exception 'motivo-requerido';
  end if;
  if closure_reason = 'otro' and clean_detail is null then
    raise exception 'motivo-requerido';
  end if;
  if clean_detail is not null and length(clean_detail) > 500 then
    raise exception 'nota-larga';
  end if;

  perform public.lock_request(target_request_id);
  return public.apply_closures(target_request_id, closure_items, closure_reason, clean_detail);
end;
$$;

revoke execute on function public.close_request_items(uuid, jsonb, text, text) from public;
grant execute on function public.close_request_items(uuid, jsonb, text, text) to authenticated;

-- Anula una entrega: sus cantidades vuelven a pendiente (delivered_quantity suma solo las activas).
create or replace function public.void_delivery(target_delivery_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.deliveries;
  clean_reason text := nullif(btrim(reason), '');
  before_quantities jsonb;
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

  select * into target from public.deliveries where id = target_delivery_id;
  if not found then
    raise exception 'entrega-invalida';
  end if;

  perform public.lock_request(target.request_id);
  -- Releer con la solicitud bloqueada: otra anulación pudo terminar mientras se esperaba el bloqueo.
  select * into target from public.deliveries where id = target_delivery_id for update;
  if target.voided_at is not null then
    raise exception 'ya-anulada';
  end if;

  before_quantities := public.request_quantities(target.request_id);

  update public.delivery_items set status = 'voided' where delivery_id = target.id;
  update public.deliveries
  set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason
  where id = target.id;

  perform public.write_audit(
    'delivery.voided', 'delivery', target.id, before_quantities,
    jsonb_build_object('request_id', target.request_id, 'delivery_number', target.delivery_number, 'items', public.request_quantities(target.request_id)),
    clean_reason
  );
end;
$$;

revoke execute on function public.void_delivery(uuid, text) from public;
grant execute on function public.void_delivery(uuid, text) to authenticated;

-- Cancelación por el solicitante: solo solicitudes de su centro y sus rubros, sin entregas activas.
-- Cierra todo lo pendiente con motivo 'cancelada'.
create or replace function public.cancel_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.requests;
begin
  if public.current_app_role() is distinct from 'requester' then
    raise exception 'sin-permiso';
  end if;

  target := public.lock_request(target_request_id);
  if target.health_center_id is distinct from public.current_health_center_id() or not public.has_area(target.area) then
    raise exception 'solicitud-invalida';
  end if;

  if exists (
    select 1 from public.delivery_items di
    where di.request_id = target_request_id and di.status = 'active'
  ) then
    raise exception 'con-entregas';
  end if;

  perform public.apply_closures(target_request_id, null, 'cancelada', null);
end;
$$;

revoke execute on function public.cancel_request(uuid) from public;
grant execute on function public.cancel_request(uuid) to authenticated;

notify pgrst, 'reload schema';
