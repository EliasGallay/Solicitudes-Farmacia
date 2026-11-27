-- Novedades de personal (docs/plans/diseno-novedades-personal.md): hechos del trabajador que no son
-- licencias. La categoría es libre; el seguimiento se agrega como eventos con fecha.
-- Solo admin. Escrituras por RPCs security definer con auditoría. Nada se borra: las novedades se anulan
-- con motivo y los eventos no se editan.
-- Requiere 202611260001_staff.sql (helpers staff_require_admin, staff_text).
-- Verificación: supabase/checks/personal.sql (sección de novedades).

-- 1. Tablas --------------------------------------------------------------------------------------

create table public.staff_incidents (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  category text not null check (length(category) between 1 and 60 and category = btrim(category)),
  occurred_on date not null,
  ends_on date,
  description text check (description is null or (length(description) between 1 and 500 and description = btrim(description))),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles(user_id) on delete restrict,
  void_reason text check (void_reason is null or (length(void_reason) between 1 and 500 and void_reason = btrim(void_reason))),
  constraint staff_incidents_range check (ends_on is null or ends_on >= occurred_on),
  constraint staff_incidents_void_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);
create index on public.staff_incidents (staff_member_id, occurred_on);

-- Seguimiento: pedidos, recepciones y cualquier otro hecho posterior. Solo se agrega.
create table public.staff_incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.staff_incidents(id) on delete restrict,
  event_on date not null,
  note text not null check (length(note) between 1 and 500 and note = btrim(note)),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict
);
create index on public.staff_incident_events (incident_id, event_on);

-- 2. Acceso: solo admin lee; las escrituras van por RPCs -----------------------------------------

alter table public.staff_incidents enable row level security;
alter table public.staff_incident_events enable row level security;
revoke all on public.staff_incidents, public.staff_incident_events from public, anon, authenticated;
grant select on public.staff_incidents, public.staff_incident_events to authenticated;

create policy staff_incidents_select_admin on public.staff_incidents
for select to authenticated using (public.current_app_role() = 'admin');

create policy staff_incident_events_select_admin on public.staff_incident_events
for select to authenticated using (public.current_app_role() = 'admin');

-- 3. RPCs ----------------------------------------------------------------------------------------

create or replace function public.staff_register_incident(
  p_staff_member_id uuid,
  p_category text,
  p_occurred_on date,
  p_ends_on date,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_category text := public.staff_text(p_category, 60, 'staff_invalid_incident_category');
  v_description text := public.staff_text(p_description, 500, 'staff_invalid_details');
  v_row public.staff_incidents;
begin
  perform public.staff_require_admin();

  perform 1 from public.staff_members where id = p_staff_member_id and active for update;
  if not found then
    raise exception 'staff_not_found';
  end if;

  if v_category is null then
    raise exception 'staff_invalid_incident_category';
  end if;

  -- Ninguna fecha puede estar en el futuro, y el fin no puede ser anterior al hecho.
  if p_occurred_on is null or p_occurred_on > v_today then
    raise exception 'staff_invalid_incident_dates';
  end if;
  if p_ends_on is not null and (p_ends_on < p_occurred_on or p_ends_on > v_today) then
    raise exception 'staff_invalid_incident_dates';
  end if;

  insert into public.staff_incidents (
    staff_member_id, category, occurred_on, ends_on, description, created_by
  ) values (
    p_staff_member_id, v_category, p_occurred_on, p_ends_on, v_description, auth.uid()
  )
  returning * into v_row;
  v_id := v_row.id;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_incident.register', 'staff_incident', v_id, null, to_jsonb(v_row), 'Alta de novedad');

  return v_id;
end;
$$;

create or replace function public.staff_add_incident_event(p_incident_id uuid, p_event_on date, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_note text := public.staff_text(p_note, 500, 'staff_invalid_details');
  v_incident public.staff_incidents;
  v_row public.staff_incident_events;
begin
  perform public.staff_require_admin();

  select * into v_incident from public.staff_incidents where id = p_incident_id for update;
  if not found then
    raise exception 'staff_not_found';
  end if;
  if v_incident.voided_at is not null then
    raise exception 'staff_already_voided';
  end if;

  if v_note is null then
    raise exception 'staff_invalid_incident_note';
  end if;

  -- El evento va entre la fecha del hecho y hoy.
  if p_event_on is null or p_event_on < v_incident.occurred_on or p_event_on > v_today then
    raise exception 'staff_invalid_incident_dates';
  end if;

  insert into public.staff_incident_events (incident_id, event_on, note, created_by)
  values (p_incident_id, p_event_on, v_note, auth.uid())
  returning * into v_row;
  v_id := v_row.id;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_incident.event', 'staff_incident', p_incident_id, null, to_jsonb(v_row), 'Seguimiento de novedad');

  return v_id;
end;
$$;

create or replace function public.staff_void_incident(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.staff_incidents;
  v_after public.staff_incidents;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.staff_require_admin();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'staff_reason_required';
  end if;

  select * into v_before from public.staff_incidents where id = p_id for update;
  if not found then
    raise exception 'staff_not_found';
  end if;
  if v_before.voided_at is not null then
    raise exception 'staff_already_voided';
  end if;

  update public.staff_incidents set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = v_reason
  where id = p_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_incident.void', 'staff_incident', p_id, to_jsonb(v_before), to_jsonb(v_after), v_reason);
end;
$$;

-- 4. Permisos de ejecución -----------------------------------------------------------------------

revoke execute on function public.staff_register_incident(uuid, text, date, date, text) from public, anon;
revoke execute on function public.staff_add_incident_event(uuid, date, text) from public, anon;
revoke execute on function public.staff_void_incident(uuid, text) from public, anon;
grant execute on function public.staff_register_incident(uuid, text, date, date, text) to authenticated;
grant execute on function public.staff_add_incident_event(uuid, date, text) to authenticated;
grant execute on function public.staff_void_incident(uuid, text) to authenticated;
