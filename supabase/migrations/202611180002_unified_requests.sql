-- Estado 'unified' (Unificada) y registro de unificaciones. Requiere 202611180001_merge_requests.sql.
-- La origen queda con estado 'unified' y apunta a la destino; la destino lista de qué solicitudes
-- recibió lo pendiente. Cada unificación es un registro inmutable en request_merges (nada se borra).

-- 1. Registro -----------------------------------------------------------------------------------

create table public.request_merges (
  id uuid primary key default gen_random_uuid(),
  -- Una solicitud origen solo se unifica una vez.
  source_request_id uuid not null unique references public.requests(id) on delete restrict,
  target_request_id uuid not null references public.requests(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_request_id <> target_request_id)
);

create index on public.request_merges (target_request_id);

-- Solo lectura desde la app: se escribe con merge_requests. Visible para quien ve la origen (la
-- política de requests decide por centro, rubro y rol).
alter table public.request_merges enable row level security;
create policy request_merges_select on public.request_merges
  for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_merges.source_request_id));
grant select on public.request_merges to authenticated;

-- 2. Estado calculado ---------------------------------------------------------------------------

-- Igual que 202610210001_purchase_requirements.sql, más 'unified' (lo primero: una origen unificada
-- no tiene entregas ni pendiente).
create or replace function public.request_status(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when exists (select 1 from public.request_merges m where m.source_request_id = request.id) then 'unified'
    when q.pending = 0 and q.delivered > 0
      and public.receipt_unconfirmed_count(request) = 0
      and public.receipt_discrepancy_count(request) = 0 then 'received'
    when q.pending > 0 and q.delivered = 0 and request.purchase_requirement_number is not null then 'purchase'
    else public.quantity_status(q.delivered, q.pending)
  end
  from (select public.total_delivered_quantity(request) as delivered, public.total_pending_quantity(request) as pending) q;
$$;

-- 3. RPC: merge_requests con registro ------------------------------------------------------------

-- Igual que 202611180001_merge_requests.sql, más el registro en request_merges.
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

  insert into public.request_merges (source_request_id, target_request_id, reason, created_by)
  values (source_request_id, target_request_id, clean_reason, auth.uid());

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
