-- Cantidades calculadas por ítem de solicitud, expuestas como columnas computadas de PostgREST
-- para poder seleccionarlas y filtrarlas (ej. request_items?pending_quantity=gt.0).
-- Misma regla que src/lib/quantities.ts (openQuantity):
--   pendiente = solicitado - entregado (entregas activas) - cerrado.
-- security invoker: se respetan las políticas RLS de quien consulta.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.delivered_quantity(item public.request_items)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(di.current_quantity), 0)::integer
  from public.delivery_items di
  where di.request_item_id = item.id
    and di.status = 'active';
$$;

create or replace function public.pending_quantity(item public.request_items)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select item.requested_quantity - item.closed_quantity - public.delivered_quantity(item);
$$;

revoke execute on function public.delivered_quantity(public.request_items) from public;
revoke execute on function public.pending_quantity(public.request_items) from public;
grant execute on function public.delivered_quantity(public.request_items) to authenticated;
grant execute on function public.pending_quantity(public.request_items) to authenticated;

-- PostgREST debe recargar su caché de esquema para ver las nuevas columnas computadas.
notify pgrst, 'reload schema';
