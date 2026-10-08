-- Notificaciones dentro de la app (docs/plans/plan-notificaciones.md).
-- Requiere 202610040001_delivery_receipts.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Se generan con un trigger sobre audit_events: cada operación de negocio ya escribe su evento de
-- auditoría dentro de su transacción, así que las notificaciones nacen en la misma transacción
-- sin reescribir las RPCs. Si la operación falla, no queda ni el evento ni la notificación.
--
-- Destinatarios: toda operación sobre una solicitud se notifica a los admins activos y a los
-- solicitantes activos del centro con el rubro de la solicitud. Quien hizo la operación nunca se
-- notifica a sí mismo.

-- 1. Tabla --------------------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Al eliminar un usuario sin actividad se van sus notificaciones (no son historial: eso es la auditoría).
  recipient_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in (
    'request.created', 'request.cancelled', 'delivery.registered', 'delivery.voided',
    'items.closed', 'delivery.received', 'receipt.difference', 'receipt.resolved'
  )),
  request_id uuid not null references public.requests(id) on delete restrict,
  delivery_id uuid references public.deliveries(id) on delete restrict,
  actor_id uuid references public.profiles(user_id) on delete set null,
  audit_event_id uuid not null references public.audit_events(id) on delete restrict,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (audit_event_id, recipient_id)
);
create index on public.notifications (recipient_id, created_at desc);
create index on public.notifications (recipient_id) where read_at is null;

-- Cada uno ve solo las suyas. Sin grants de escritura: se generan por trigger y se marcan como
-- leídas con mark_notifications_read.
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications
for select to authenticated
using (recipient_id = auth.uid());

-- 2. Generación ---------------------------------------------------------------------------------

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

revoke execute on function public.notify_from_audit() from public;

create trigger audit_events_notify
after insert on public.audit_events
for each row execute function public.notify_from_audit();

-- 3. Lectura ------------------------------------------------------------------------------------

-- Marca como leídas las notificaciones indicadas, o todas si no se indica ninguna. Solo las propias.
create or replace function public.mark_notifications_read(notification_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  marked integer;
begin
  if auth.uid() is null then
    raise exception 'sin-permiso';
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null
    and (notification_ids is null or id = any(notification_ids));
  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

notify pgrst, 'reload schema';
