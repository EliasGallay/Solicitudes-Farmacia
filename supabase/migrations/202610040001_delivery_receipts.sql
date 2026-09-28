-- Confirmación de recepción por el centro, ítem por ítem (docs/plans/plan-gestion-solicitudes.md,
-- fase 8). Requiere 202610020001_request_management.sql y 202610030001_request_actor_names.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Reglas:
-- - Cualquier solicitante del centro y rubro de la solicitud confirma cada línea entregada, con la
--   cantidad que realmente llegó. Si llegó menos, el comentario es obligatorio y la línea queda
--   "con diferencia" hasta que el admin la resuelva:
--     'reenviar': lo que faltó vuelve a pendiente (para una nueva entrega);
--     'cerrar':   lo que faltó se cierra con motivo 'no_recibido'.
-- - Mientras la diferencia no se resuelve, la línea sigue contando como entregada. Al resolverla,
--   cuenta lo recibido (delivered_quantity).
-- - La solicitud pasa a 'received' (Recibida) cuando no queda pendiente y todas las líneas
--   entregadas están confirmadas sin diferencias abiertas. 'completed' pasa a significar
--   "entregada, falta confirmar".
-- - Una entrega con alguna línea confirmada ya no se puede anular.

-- 1. Recepciones -------------------------------------------------------------------------------

create table public.delivery_item_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  delivery_item_id uuid not null unique references public.delivery_items(id) on delete restrict,
  -- Lo entregado en esa línea al confirmar (delivery_items.current_quantity).
  delivered_quantity integer not null check (delivered_quantity > 0),
  received_quantity integer not null check (received_quantity >= 0 and received_quantity <= delivered_quantity),
  comment text check (comment is null or length(comment) <= 500),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  resolution text check (resolution in ('reenviar', 'cerrar')),
  resolution_note text check (resolution_note is null or length(resolution_note) <= 500),
  resolved_by uuid references public.profiles(user_id) on delete restrict,
  resolved_at timestamptz,
  -- Si llegó menos de lo entregado, el comentario es obligatorio.
  constraint delivery_item_receipts_comment_on_difference check (
    received_quantity = delivered_quantity or coalesce(length(btrim(comment)), 0) > 0
  ),
  -- Solo una diferencia se resuelve, y la resolución tiene tipo, autor y fecha.
  constraint delivery_item_receipts_resolution_consistent check (
    (resolution is null and resolved_by is null and resolved_at is null)
    or (resolution is not null and resolved_by is not null and resolved_at is not null and received_quantity < delivered_quantity)
  )
);
create index on public.delivery_item_receipts (request_id, created_at);

alter table public.delivery_item_receipts enable row level security;
grant select on public.delivery_item_receipts to authenticated;

-- Misma regla que deliveries y request_item_closures.
create policy delivery_item_receipts_select_allowed on public.delivery_item_receipts
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = delivery_item_receipts.request_id
      and r.health_center_id = public.current_health_center_id()
      and public.has_area(r.area)
  )
);

-- Cierre del faltante al resolver una diferencia.
alter table public.request_item_closures drop constraint request_item_closures_reason_check;
alter table public.request_item_closures add constraint request_item_closures_reason_check
  check (reason in ('sin_stock', 'discontinuado', 'rechazado', 'duplicado', 'cancelada', 'otro', 'no_recibido'));

-- 2. Cantidades y estados ----------------------------------------------------------------------

-- Entregado: suma de las líneas activas; en una diferencia resuelta cuenta lo recibido.
create or replace function public.delivered_quantity(item public.request_items)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(case when r.resolved_at is not null then r.received_quantity else di.current_quantity end), 0)::integer
  from public.delivery_items di
  left join public.delivery_item_receipts r on r.delivery_item_id = di.id
  where di.request_item_id = item.id
    and di.status = 'active';
$$;

-- Líneas activas de la solicitud que nadie confirmó todavía.
create or replace function public.receipt_unconfirmed_count(request public.requests)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.delivery_items di
  where di.request_id = request.id
    and di.status = 'active'
    and not exists (select 1 from public.delivery_item_receipts r where r.delivery_item_id = di.id);
$$;

-- Líneas activas confirmadas con diferencia que el admin todavía no resolvió.
create or replace function public.receipt_discrepancy_count(request public.requests)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.delivery_item_receipts r
  join public.delivery_items di on di.id = r.delivery_item_id
  where r.request_id = request.id
    and di.status = 'active'
    and r.received_quantity < r.delivered_quantity
    and r.resolved_at is null;
$$;

-- True si el ítem tiene alguna línea activa sin confirmar o con diferencia abierta.
create or replace function public.item_receipt_open(item public.request_items)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.delivery_items di
    left join public.delivery_item_receipts r on r.delivery_item_id = di.id
    where di.request_item_id = item.id
      and di.status = 'active'
      and (r.id is null or (r.received_quantity < r.delivered_quantity and r.resolved_at is null))
  );
$$;

create or replace function public.item_status(item public.request_items)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when q.pending = 0 and q.delivered > 0 and not public.item_receipt_open(item) then 'received'
    else public.quantity_status(q.delivered, q.pending)
  end
  from (select public.delivered_quantity(item) as delivered, public.pending_quantity(item) as pending) q;
$$;

create or replace function public.request_status(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when q.pending = 0 and q.delivered > 0
      and public.receipt_unconfirmed_count(request) = 0
      and public.receipt_discrepancy_count(request) = 0 then 'received'
    else public.quantity_status(q.delivered, q.pending)
  end
  from (select public.total_delivered_quantity(request) as delivered, public.total_pending_quantity(request) as pending) q;
$$;

revoke execute on function public.receipt_unconfirmed_count(public.requests) from public;
revoke execute on function public.receipt_discrepancy_count(public.requests) from public;
revoke execute on function public.item_receipt_open(public.request_items) from public;
grant execute on function public.receipt_unconfirmed_count(public.requests) to authenticated;
grant execute on function public.receipt_discrepancy_count(public.requests) to authenticated;
grant execute on function public.item_receipt_open(public.request_items) to authenticated;

-- 3. RPCs ----------------------------------------------------------------------------------------

-- Confirma la recepción de líneas entregadas. `receipt_lines`:
-- [{delivery_item_id, received_quantity, comment}]. Se pueden confirmar algunas líneas y dejar
-- otras para después; una línea confirmada no se vuelve a confirmar.
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
    if received < delivered_line.current_quantity and line_comment is null then
      raise exception 'comentario-requerido';
    end if;
    if line_comment is not null and length(line_comment) > 500 then
      raise exception 'nota-larga';
    end if;

    insert into public.delivery_item_receipts (request_id, delivery_item_id, delivered_quantity, received_quantity, comment, created_by)
    values (target_request_id, line_id, delivered_line.current_quantity, received, line_comment, auth.uid());
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

-- Resuelve una diferencia de recepción: 'reenviar' (vuelve a pendiente) o 'cerrar' (se cierra el
-- faltante con motivo 'no_recibido').
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

  -- Al resolver, la línea cuenta lo recibido: el faltante vuelve a pendiente. Si se cierra, se
  -- registra el cierre por esa misma cantidad.
  if target_resolution = 'cerrar' then
    insert into public.request_item_closures (request_id, request_item_id, quantity, reason, detail, created_by)
    values (receipt.request_id, target_item_id, missing, 'no_recibido', clean_note, auth.uid());
    update public.request_items set closed_quantity = closed_quantity + missing where id = target_item_id;
  end if;

  perform public.write_audit(
    'receipt.resolved', 'request', receipt.request_id, before_quantities,
    jsonb_build_object('receipt_id', receipt.id, 'resolution', target_resolution, 'missing', missing, 'items', public.request_quantities(receipt.request_id)),
    coalesce(clean_note, case when target_resolution = 'reenviar' then 'Faltante vuelve a pendiente' else 'Faltante cerrado' end)
  );
end;
$$;

revoke execute on function public.resolve_receipt_difference(uuid, text, text) from public;
grant execute on function public.resolve_receipt_difference(uuid, text, text) to authenticated;

-- Anulación: igual que en 202610020001, pero rechaza entregas con alguna línea ya confirmada.
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
  select * into target from public.deliveries where id = target_delivery_id for update;
  if target.voided_at is not null then
    raise exception 'ya-anulada';
  end if;
  if exists (
    select 1 from public.delivery_item_receipts r
    join public.delivery_items di on di.id = r.delivery_item_id
    where di.delivery_id = target.id
  ) then
    raise exception 'con-recepcion';
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

-- 4. Nombres para la trazabilidad: se suman quienes confirmaron y quienes resolvieron -------------

create or replace function public.request_actor_names(target_request_id uuid)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.id, r.created_by
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
    select d.created_by from public.deliveries d join visible v on v.id = d.request_id
    union
    select d.voided_by from public.deliveries d join visible v on v.id = d.request_id where d.voided_by is not null
    union
    select c.created_by from public.request_item_closures c join visible v on v.id = c.request_id
    union
    select rc.created_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id
    union
    select rc.resolved_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id where rc.resolved_by is not null
  )
  select p.user_id, p.full_name
  from public.profiles p
  join actors a on a.actor_id = p.user_id;
$$;

notify pgrst, 'reload schema';
