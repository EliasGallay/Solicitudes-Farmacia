-- Anulación de seguimientos de novedades, de a uno y con motivo (docs/plans/diseno-novedades-personal.md,
-- decisión del 2026-11-27). Un seguimiento mal cargado se anula y se agrega otro. Nada se borra ni se edita.
-- Solo admin. Escritura por RPC security definer con auditoría.
-- Requiere 202611270001_staff_incidents.sql.

-- 1. Columnas de anulación -----------------------------------------------------------------------

alter table public.staff_incident_events
  add column voided_at timestamptz,
  add column voided_by uuid references public.profiles(user_id) on delete restrict,
  add column void_reason text check (void_reason is null or (length(void_reason) between 1 and 500 and void_reason = btrim(void_reason))),
  add constraint staff_incident_events_void_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  );

-- 2. RPC -----------------------------------------------------------------------------------------

create or replace function public.staff_void_incident_event(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_incident_id uuid;
  v_member uuid;
  v_before public.staff_incident_events;
  v_after public.staff_incident_events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.staff_require_admin();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'staff_reason_required';
  end if;

  -- Mismo orden de bloqueo que las demás escrituras del módulo: primero la persona.
  select e.incident_id, i.staff_member_id into v_incident_id, v_member
  from public.staff_incident_events e
  join public.staff_incidents i on i.id = e.incident_id
  where e.id = p_event_id;
  if not found then
    raise exception 'staff_not_found';
  end if;
  perform 1 from public.staff_members where id = v_member for update;

  select * into v_before from public.staff_incident_events where id = p_event_id for update;
  if v_before.voided_at is not null then
    raise exception 'staff_event_already_voided';
  end if;

  -- Una novedad anulada es de solo lectura: tampoco se anulan sus seguimientos.
  if exists (select 1 from public.staff_incidents where id = v_incident_id and voided_at is not null) then
    raise exception 'staff_already_voided';
  end if;

  update public.staff_incident_events set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = v_reason
  where id = p_event_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_incident_event.void', 'staff_incident_event', p_event_id, to_jsonb(v_before), to_jsonb(v_after), v_reason);
end;
$$;

-- 3. Permisos de ejecución -----------------------------------------------------------------------

revoke execute on function public.staff_void_incident_event(uuid, text) from public, anon;
grant execute on function public.staff_void_incident_event(uuid, text) to authenticated;
