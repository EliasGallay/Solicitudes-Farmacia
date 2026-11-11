-- Notificaciones del módulo Movilidad (docs/plans/plan-movilidad.md, tarea 7). Requiere
-- 202610080001_notifications.sql y 202610280001_fleet.sql.
-- Verificación: supabase/checks/movilidad.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Una notificación es de una solicitud de insumos (request_id) o de una solicitud de servicio de
-- Movilidad (vehicle_request_id). Se avisa la solicitud creada, el requerimiento de compra, la
-- solicitud completada y la cancelada a los admins activos y a los usuarios activos con el rubro
-- 'fleet', salvo a quien hizo la operación. Los registros directos del historial no notifican.

-- 1. Tabla --------------------------------------------------------------------------------------

alter table public.notifications alter column request_id drop not null;
alter table public.notifications add column vehicle_request_id uuid references public.vehicle_requests(id) on delete restrict;
alter table public.notifications add constraint notifications_one_request check (num_nonnulls(request_id, vehicle_request_id) = 1);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'request.created', 'request.cancelled', 'delivery.registered', 'delivery.voided',
  'items.closed', 'delivery.received', 'receipt.difference', 'receipt.resolved',
  'vehicle_request.created', 'vehicle_request.purchase_requirement', 'vehicle_request.completed', 'vehicle_request.cancelled'
));

-- 2. Generación ---------------------------------------------------------------------------------

-- Igual que 202610080001, más la rama de Movilidad al principio.
create or replace function public.notify_from_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_request public.requests;
  target_request_id uuid;
  target_delivery_id uuid;
  notification_kind text;
begin
  if new.entity_type = 'vehicle_request' then
    if new.action not in ('vehicle_request.created', 'vehicle_request.purchase_requirement', 'vehicle_request.completed', 'vehicle_request.cancelled') then
      return new;
    end if;
    insert into public.notifications (recipient_id, kind, vehicle_request_id, actor_id, audit_event_id)
    select p.user_id, new.action, new.entity_id, new.actor_id, new.id
    from public.profiles p
    where p.active
      and p.user_id <> new.actor_id
      and (
        p.role = 'admin'
        or (p.role = 'requester' and exists (select 1 from public.profile_areas pa where pa.user_id = p.user_id and pa.area = 'fleet'))
      )
    on conflict (audit_event_id, recipient_id) do nothing;
    return new;
  end if;

  if new.entity_type = 'request' then
    target_request_id := new.entity_id;
  elsif new.entity_type = 'delivery' then
    target_delivery_id := new.entity_id;
    target_request_id := (new.after_data->>'request_id')::uuid;
  end if;
  if target_request_id is null then
    return new;
  end if;

  case new.action
    when 'request.created', 'request.cancelled', 'delivery.registered', 'delivery.voided', 'items.closed', 'receipt.resolved' then
      notification_kind := new.action;
    when 'delivery.received' then
      -- Si alguna línea confirmada llegó con menos de lo entregado, se avisa como diferencia.
      notification_kind := case when exists (
        select 1
        from jsonb_array_elements(coalesce(new.after_data->'lines', '[]'::jsonb)) line
        join public.delivery_item_receipts r on r.delivery_item_id = (line->>'delivery_item_id')::uuid
        where r.received_quantity < r.delivered_quantity
      ) then 'receipt.difference' else 'delivery.received' end;
    else
      return new;
  end case;

  select * into target_request from public.requests where id = target_request_id;
  if not found then
    return new;
  end if;

  insert into public.notifications (recipient_id, kind, request_id, delivery_id, actor_id, audit_event_id)
  select p.user_id, notification_kind, target_request_id, target_delivery_id, new.actor_id, new.id
  from public.profiles p
  where p.active
    and p.user_id <> new.actor_id
    and (
      p.role = 'admin'
      or (
        p.role = 'requester'
        and p.health_center_id = target_request.health_center_id
        and exists (select 1 from public.profile_areas pa where pa.user_id = p.user_id and pa.area = target_request.area)
      )
    )
  on conflict (audit_event_id, recipient_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.notify_from_audit() from public, anon, authenticated;

-- write_audit solo se revocaba de public y Supabase da EXECUTE explícito a anon y authenticated: se
-- podía llamar desde la API y, con este trigger, una auditoría falsificada generaría notificaciones.
-- La app nunca la llama directo; las RPCs security definer la siguen usando.
revoke execute on function public.write_audit(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
