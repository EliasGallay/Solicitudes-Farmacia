-- Corrección de licencias y novedades de personal. Hoy un error de carga obligaba a anular y volver a
-- cargar. Estas RPCs editan la fila en su lugar, con las mismas reglas del alta, y dejan antes y después
-- en audit_events. Solo admin. Los seguimientos de novedades no se editan (solo se agregan).
-- Requiere 202611260001_staff.sql y 202611270001_staff_incidents.sql.

-- 1. Licencias -----------------------------------------------------------------------------------

create or replace function public.staff_update_leave(
  p_id uuid,
  p_kind text,
  p_starts_on date,
  p_ends_on date,
  p_days integer,
  p_hours numeric,
  p_note text,
  p_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_before public.staff_leaves;
  v_after public.staff_leaves;
  v_ends date := p_ends_on;
  v_days integer := p_days;
  v_hours numeric := p_hours;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_comment text := public.staff_text(p_comment, 500, 'staff_invalid_details');
begin
  perform public.staff_require_admin();

  -- Mismo orden de bloqueo que el alta: primero la persona, después la licencia.
  select staff_member_id into v_member from public.staff_leaves where id = p_id;
  if not found then
    raise exception 'staff_not_found';
  end if;
  perform 1 from public.staff_members where id = v_member for update;

  select * into v_before from public.staff_leaves where id = p_id for update;
  if v_before.voided_at is not null then
    raise exception 'staff_already_voided';
  end if;

  if p_kind not in ('vacation', 'hours_permit', 'other') then
    raise exception 'staff_invalid_kind';
  end if;

  if p_kind = 'hours_permit' then
    if p_hours is null or p_hours not in (1.5, 3) then
      raise exception 'staff_invalid_hours';
    end if;
    if p_days is not null then
      raise exception 'staff_invalid_days';
    end if;
    v_ends := p_starts_on;
    v_days := null;
    v_note := null;
  else
    if p_hours is not null then
      raise exception 'staff_invalid_hours';
    end if;
    if p_days is null or p_days not between 1 and 366 then
      raise exception 'staff_invalid_days';
    end if;
    if v_ends is null or p_starts_on is null or v_ends < p_starts_on then
      raise exception 'staff_invalid_range';
    end if;
    if p_kind = 'other' and v_note is null then
      raise exception 'staff_note_required';
    end if;
    if p_kind <> 'other' then
      v_note := null;
    end if;
    if v_note is not null and length(v_note) > 500 then
      raise exception 'staff_invalid_details';
    end if;
    v_hours := null;
  end if;

  -- Vacaciones y otras no pueden solaparse con otra licencia activa de la misma persona. Se excluye la propia.
  if p_kind in ('vacation', 'other') and exists (
    select 1 from public.staff_leaves l
    where l.staff_member_id = v_member
      and l.id <> p_id
      and l.voided_at is null
      and l.kind in ('vacation', 'other')
      and daterange(l.starts_on, l.ends_on, '[]') && daterange(p_starts_on, v_ends, '[]')
  ) then
    raise exception 'staff_overlap';
  end if;

  update public.staff_leaves set
    kind = p_kind,
    starts_on = p_starts_on,
    ends_on = v_ends,
    days = v_days,
    hours = v_hours,
    note = v_note,
    comment = v_comment
  where id = p_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_leave.update', 'staff_leave', p_id, to_jsonb(v_before), to_jsonb(v_after), 'Corrección de licencia');
end;
$$;

-- 2. Novedades -----------------------------------------------------------------------------------

create or replace function public.staff_update_incident(
  p_id uuid,
  p_category text,
  p_occurred_on date,
  p_ends_on date,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_category text := public.staff_text(p_category, 60, 'staff_invalid_incident_category');
  v_description text := public.staff_text(p_description, 500, 'staff_invalid_details');
  v_before public.staff_incidents;
  v_after public.staff_incidents;
begin
  perform public.staff_require_admin();

  select staff_member_id into v_member from public.staff_incidents where id = p_id;
  if not found then
    raise exception 'staff_not_found';
  end if;
  perform 1 from public.staff_members where id = v_member for update;

  select * into v_before from public.staff_incidents where id = p_id for update;
  if v_before.voided_at is not null then
    raise exception 'staff_already_voided';
  end if;

  if v_category is null then
    raise exception 'staff_invalid_incident_category';
  end if;

  -- Mismas reglas de fecha que el alta.
  if p_occurred_on is null or p_occurred_on > v_today then
    raise exception 'staff_invalid_incident_dates';
  end if;
  if p_ends_on is not null and (p_ends_on < p_occurred_on or p_ends_on > v_today) then
    raise exception 'staff_invalid_incident_dates';
  end if;

  -- Ningún seguimiento puede quedar antes del hecho corregido.
  if exists (
    select 1 from public.staff_incident_events e
    where e.incident_id = p_id and e.event_on < p_occurred_on
  ) then
    raise exception 'staff_invalid_incident_dates';
  end if;

  update public.staff_incidents set
    category = v_category,
    occurred_on = p_occurred_on,
    ends_on = p_ends_on,
    description = v_description
  where id = p_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_incident.update', 'staff_incident', p_id, to_jsonb(v_before), to_jsonb(v_after), 'Corrección de novedad');
end;
$$;

-- 3. Permisos de ejecución -----------------------------------------------------------------------

revoke execute on function public.staff_update_leave(uuid, text, date, date, integer, numeric, text, text) from public, anon;
revoke execute on function public.staff_update_incident(uuid, text, date, date, text) from public, anon;
grant execute on function public.staff_update_leave(uuid, text, date, date, integer, numeric, text, text) to authenticated;
grant execute on function public.staff_update_incident(uuid, text, date, date, text) to authenticated;
