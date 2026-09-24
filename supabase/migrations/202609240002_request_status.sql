-- Estado de solicitudes y de sus ítems, derivado de cantidades y expuesto como columnas
-- computadas de PostgREST (seleccionables y filtrables, ej. requests?request_status=eq.pending).
-- Requiere 202609240001_request_item_quantities.sql.
--
-- Regla (docs/ui-reference/UI-SPEC.md §10):
--   pendiente > 0 y entregado = 0 -> 'pending'   (Pendiente)
--   pendiente > 0 y entregado > 0 -> 'partial'   (Entrega parcial)
--   pendiente = 0 y entregado > 0 -> 'completed' (Completada)
--   pendiente = 0 y entregado = 0 -> 'closed'    (Cerrada: todo cerrado sin entregas)
-- Para una solicitud se aplica sobre la suma de sus ítems.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.quantity_status(delivered integer, pending integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when pending > 0 and delivered > 0 then 'partial'
    when pending > 0 then 'pending'
    when delivered > 0 then 'completed'
    else 'closed'
  end;
$$;

create or replace function public.item_status(item public.request_items)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.quantity_status(public.delivered_quantity(item), public.pending_quantity(item));
$$;

create or replace function public.total_delivered_quantity(request public.requests)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(public.delivered_quantity(ri)), 0)::integer
  from public.request_items ri
  where ri.request_id = request.id;
$$;

create or replace function public.total_pending_quantity(request public.requests)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(public.pending_quantity(ri)), 0)::integer
  from public.request_items ri
  where ri.request_id = request.id;
$$;

create or replace function public.request_status(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.quantity_status(public.total_delivered_quantity(request), public.total_pending_quantity(request));
$$;

revoke execute on function public.quantity_status(integer, integer) from public;
revoke execute on function public.item_status(public.request_items) from public;
revoke execute on function public.total_delivered_quantity(public.requests) from public;
revoke execute on function public.total_pending_quantity(public.requests) from public;
revoke execute on function public.request_status(public.requests) from public;
grant execute on function public.quantity_status(integer, integer) to authenticated;
grant execute on function public.item_status(public.request_items) to authenticated;
grant execute on function public.total_delivered_quantity(public.requests) to authenticated;
grant execute on function public.total_pending_quantity(public.requests) to authenticated;
grant execute on function public.request_status(public.requests) to authenticated;

notify pgrst, 'reload schema';
