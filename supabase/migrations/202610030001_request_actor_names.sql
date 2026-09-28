-- Nombres de quienes actuaron sobre una solicitud, para la trazabilidad de /solicitudes/[id].
-- Requiere 202610020001_request_management.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Por RLS, un solicitante solo lee su propio perfil: no podía ver el nombre del compañero de centro
-- que creó o canceló una solicitud, ni el del admin que la entregó. Esta función devuelve solo
-- user_id y full_name, y solo de las personas que figuran en los registros de esa solicitud
-- (creación, entregas, anulaciones y cierres), si quien consulta puede ver la solicitud con la
-- misma regla que requests_select_allowed. El resto del perfil (email, rol, centro, estado) sigue
-- protegido.

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
  )
  select p.user_id, p.full_name
  from public.profiles p
  join actors a on a.actor_id = p.user_id;
$$;

revoke execute on function public.request_actor_names(uuid) from public;
grant execute on function public.request_actor_names(uuid) to authenticated;

notify pgrst, 'reload schema';
