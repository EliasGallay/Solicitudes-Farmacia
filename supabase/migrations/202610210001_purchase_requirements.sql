-- Requerimiento de compra (docs/plans/plan-requerimientos-compra.md): el admin anota en la solicitud
-- el número que le dio el sistema de compras y la solicitud pasa a 'purchase' (En compras) hasta la
-- primera entrega. El número no es único: varias solicitudes pueden ir en el mismo requerimiento.
-- Requiere 202610040001_delivery_receipts.sql y 202609240006_search.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- 1. Datos ---------------------------------------------------------------------------------------

-- Sin grant de update: se escribe solo con set_purchase_requirement.
alter table public.requests add column purchase_requirement_number text
  check (purchase_requirement_number is null or (length(purchase_requirement_number) between 1 and 30 and purchase_requirement_number = btrim(purchase_requirement_number)));
alter table public.requests add column purchase_requirement_at timestamptz;
alter table public.requests add column purchase_requirement_by uuid references public.profiles(user_id) on delete restrict;
-- Registrado ⇔ tiene número, fecha y autor.
alter table public.requests add constraint requests_purchase_requirement_consistent check (
  (purchase_requirement_number is null and purchase_requirement_at is null and purchase_requirement_by is null)
  or (purchase_requirement_number is not null and purchase_requirement_at is not null and purchase_requirement_by is not null)
);
create index on public.requests (purchase_requirement_number) where purchase_requirement_number is not null;

-- 2. Estado --------------------------------------------------------------------------------------

-- Igual que 202610040001, más 'purchase': con pendiente, sin nada entregado y con requerimiento de
-- compra registrado. Con la primera entrega pasa a 'partial' o 'completed' como siempre.
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
    when q.pending > 0 and q.delivered = 0 and request.purchase_requirement_number is not null then 'purchase'
    else public.quantity_status(q.delivered, q.pending)
  end
  from (select public.total_delivered_quantity(request) as delivered, public.total_pending_quantity(request) as pending) q;
$$;

-- 3. Búsqueda ------------------------------------------------------------------------------------

-- Igual que 202609240006, más "req-{número}": buscar el número de requerimiento encuentra todas las
-- solicitudes que fueron en él.
create or replace function public.request_search_text(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(
    'sol-' || request.request_number || ' ' ||
    coalesce('req-' || request.purchase_requirement_number || ' ', '') ||
    coalesce((
      select string_agg(p.name || ' ' || p.presentation, ' ')
      from public.request_items ri
      join public.products p on p.id = ri.product_id
      where ri.request_id = request.id
    ), '')
  );
$$;

-- 4. RPC -----------------------------------------------------------------------------------------

-- Registra o corrige el número de requerimiento mientras la solicitud tenga pendiente. Volver a
-- guardar el mismo número no hace nada.
create or replace function public.set_purchase_requirement(target_request_id uuid, requirement_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.requests;
  clean_number text := nullif(btrim(requirement_number), '');
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'sin-permiso';
  end if;
  if clean_number is null or length(clean_number) > 30 then
    raise exception 'requerimiento-invalido';
  end if;

  target := public.lock_request(target_request_id);
  if public.total_pending_quantity(target) = 0 then
    raise exception 'requerimiento-sin-pendiente';
  end if;
  if target.purchase_requirement_number is not distinct from clean_number then
    return;
  end if;

  update public.requests
  set purchase_requirement_number = clean_number,
      purchase_requirement_at = now(),
      purchase_requirement_by = auth.uid()
  where id = target_request_id;

  perform public.write_audit(
    'request.purchase_requirement', 'request', target_request_id,
    case when target.purchase_requirement_number is null then null
      else jsonb_build_object('purchase_requirement_number', target.purchase_requirement_number) end,
    jsonb_build_object('request_number', target.request_number, 'purchase_requirement_number', clean_number),
    case when target.purchase_requirement_number is null then 'Requerimiento de compra registrado'
      else 'Requerimiento de compra corregido' end
  );
end;
$$;

revoke execute on function public.set_purchase_requirement(uuid, text) from public;
grant execute on function public.set_purchase_requirement(uuid, text) to authenticated;

notify pgrst, 'reload schema';
