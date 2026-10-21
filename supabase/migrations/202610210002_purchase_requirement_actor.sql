-- Nombre de quien registró el requerimiento de compra en el historial de la solicitud: sin esto el
-- detalle mostraba "usuario no disponible".
-- Igual que 202610040001_delivery_receipts.sql, más requests.purchase_requirement_by.
-- Requiere 202610210001_purchase_requirements.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.request_actor_names(target_request_id uuid)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.id, r.created_by, r.purchase_requirement_by
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
    select v.purchase_requirement_by from visible v where v.purchase_requirement_by is not null
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
