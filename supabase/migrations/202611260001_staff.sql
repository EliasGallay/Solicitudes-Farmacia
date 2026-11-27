-- Gestión de personal (docs/plans/diseno-gestion-personal.md, docs/plans/plan-gestion-personal.md).
-- Personal de salud con sus datos, sus CAPS y sus licencias (vacaciones, permisos por horas, otras).
-- Solo admin. Sin login para el personal: los registros los carga el admin.
-- Toda escritura pasa por RPCs security definer que validan, bloquean y escriben audit_events.
-- Nada se borra: las licencias se anulan con motivo.
-- Se aplica con .github/workflows/migrations.yml (develop y main). Ningún dato real entra a develop.
-- Verificación: supabase/checks/personal.sql.

-- 1. Tablas --------------------------------------------------------------------------------------

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(first_name) between 1 and 80 and first_name = btrim(first_name)),
  last_name text not null check (length(last_name) between 1 and 80 and last_name = btrim(last_name)),
  profession text check (profession is null or (length(profession) between 1 and 120 and profession = btrim(profession))),
  matricula text check (matricula is null or (length(matricula) between 1 and 120 and matricula = btrim(matricula))),
  dni text check (dni is null or dni ~ '^[0-9]{7,9}$'),
  phone text check (phone is null or (length(phone) between 1 and 30 and phone = btrim(phone))),
  address text check (address is null or (length(address) between 1 and 120 and address = btrim(address))),
  email text check (email is null or (length(email) between 1 and 120 and email = btrim(email))),
  birth_date date,
  hire_date date,
  comment text check (comment is null or (length(comment) between 1 and 500 and comment = btrim(comment))),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  updated_at timestamptz,
  updated_by uuid references public.profiles(user_id) on delete restrict
);

-- Un CAPS puede tener varias personas y una persona puede trabajar en varios CAPS.
create table public.staff_member_health_centers (
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  health_center_id uuid not null references public.health_centers(id) on delete restrict,
  primary key (staff_member_id, health_center_id)
);

create table public.staff_leaves (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  kind text not null check (kind in ('vacation', 'hours_permit', 'other')),
  starts_on date not null,
  ends_on date not null,
  days integer,
  hours numeric(3,1),
  note text check (note is null or (length(note) between 1 and 500 and note = btrim(note))),
  comment text check (comment is null or (length(comment) between 1 and 500 and comment = btrim(comment))),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles(user_id) on delete restrict,
  void_reason text check (void_reason is null or (length(void_reason) between 1 and 500 and void_reason = btrim(void_reason))),
  constraint staff_leaves_range check (ends_on >= starts_on),
  -- Vacaciones y otras: días descontados entre 1 y 366, sin horas. El rango puede tener más días
  -- corridos que los descontados (fin de semana o feriado): no se recalcula.
  -- Permiso: un solo día, 1,5 o 3 horas, sin días.
  constraint staff_leaves_amount check (
    (kind = 'hours_permit' and days is null and hours in (1.5, 3) and starts_on = ends_on)
    or (kind in ('vacation', 'other') and days between 1 and 366 and hours is null)
  ),
  -- La nota es obligatoria en "otra licencia" (compensatorios, estudios) y no existe en los demás tipos.
  constraint staff_leaves_note check (
    (kind = 'other' and note is not null) or (kind <> 'other' and note is null)
  ),
  constraint staff_leaves_void_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);
create index on public.staff_leaves (staff_member_id, starts_on);
create index on public.staff_leaves (starts_on, ends_on);

-- 2. Acceso: solo admin lee; las escrituras van por RPCs -----------------------------------------

alter table public.staff_members enable row level security;
alter table public.staff_member_health_centers enable row level security;
alter table public.staff_leaves enable row level security;

revoke all on public.staff_members, public.staff_member_health_centers, public.staff_leaves from public, anon, authenticated;
grant select on public.staff_members, public.staff_member_health_centers, public.staff_leaves to authenticated;

create policy staff_members_select_admin on public.staff_members
for select to authenticated using (public.current_app_role() = 'admin');

create policy staff_member_health_centers_select_admin on public.staff_member_health_centers
for select to authenticated using (public.current_app_role() = 'admin');

create policy staff_leaves_select_admin on public.staff_leaves
for select to authenticated using (public.current_app_role() = 'admin');

-- 3. Helpers internos ----------------------------------------------------------------------------

create or replace function public.staff_require_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- is distinct from: un rol nulo (sin perfil) también se rechaza. No comparar contra '' porque
  -- app_role es un enum y '' no es un valor válido.
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'staff_forbidden';
  end if;
end;
$$;

-- Texto recortado (btrim). Vacío -> null. Largo mayor al máximo -> código de error indicado.
create or replace function public.staff_text(p_value text, p_max integer, p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if v is not null and length(v) > p_max then
    raise exception '%', p_code;
  end if;
  return v;
end;
$$;

-- Nombre o apellido: espacios colapsados, obligatorio, hasta 80.
create or replace function public.staff_name(p_value text, p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := nullif(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'), '');
begin
  if v is null or length(v) > 80 then
    raise exception '%', p_code;
  end if;
  return v;
end;
$$;

-- Fecha ISO opcional. Vacío -> null; formato o fecha inválidos -> error de detalles.
create or replace function public.staff_date(p_value text)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  if btrim(p_value) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'staff_invalid_details';
  end if;
  return btrim(p_value)::date;
exception when others then
  raise exception 'staff_invalid_details';
end;
$$;

-- Valida los datos opcionales de la ficha y devuelve el jsonb normalizado con los mismos nombres.
create or replace function public.staff_details_check(p_details jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_dni text := nullif(btrim(coalesce(p_details->>'dni', '')), '');
  v_birth date := public.staff_date(p_details->>'birth_date');
  v_hire date := public.staff_date(p_details->>'hire_date');
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_dni is not null and v_dni !~ '^[0-9]{7,9}$' then
    raise exception 'staff_invalid_details';
  end if;
  if (v_birth is not null and v_birth > v_today) or (v_hire is not null and v_hire > v_today) then
    raise exception 'staff_invalid_details';
  end if;

  return jsonb_build_object(
    'profession', public.staff_text(p_details->>'profession', 120, 'staff_invalid_details'),
    'matricula', public.staff_text(p_details->>'matricula', 120, 'staff_invalid_details'),
    'dni', v_dni,
    'phone', public.staff_text(p_details->>'phone', 30, 'staff_invalid_details'),
    'address', public.staff_text(p_details->>'address', 120, 'staff_invalid_details'),
    'email', public.staff_text(p_details->>'email', 120, 'staff_invalid_details'),
    'birth_date', v_birth,
    'hire_date', v_hire,
    'comment', public.staff_text(p_details->>'comment', 500, 'staff_invalid_details')
  );
end;
$$;

-- Todos los CAPS recibidos deben existir. Devuelve la lista sin duplicados.
create or replace function public.staff_health_centers_check(p_ids uuid[])
returns uuid[]
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(array(select distinct unnest(coalesce(p_ids, '{}'))), '{}');
begin
  if (select count(*) from public.health_centers h where h.id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'staff_invalid_health_center';
  end if;
  return v_ids;
end;
$$;

-- 4. RPCs de personas ----------------------------------------------------------------------------

create or replace function public.staff_create_member(
  p_first_name text,
  p_last_name text,
  p_details jsonb,
  p_health_center_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_details jsonb;
  v_ids uuid[];
  v_row public.staff_members;
begin
  perform public.staff_require_admin();

  v_details := public.staff_details_check(coalesce(p_details, '{}'::jsonb));
  v_ids := public.staff_health_centers_check(p_health_center_ids);

  insert into public.staff_members (
    first_name, last_name, profession, matricula, dni, phone, address, email,
    birth_date, hire_date, comment, created_by
  ) values (
    public.staff_name(p_first_name, 'staff_invalid_name'),
    public.staff_name(p_last_name, 'staff_invalid_name'),
    v_details->>'profession', v_details->>'matricula', v_details->>'dni', v_details->>'phone',
    v_details->>'address', v_details->>'email',
    (v_details->>'birth_date')::date, (v_details->>'hire_date')::date,
    v_details->>'comment', auth.uid()
  )
  returning * into v_row;
  v_id := v_row.id;

  insert into public.staff_member_health_centers (staff_member_id, health_center_id)
  select v_id, unnest(v_ids);

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_member.create', 'staff_member', v_id, null, to_jsonb(v_row), 'Alta de persona');

  return v_id;
end;
$$;

create or replace function public.staff_update_member(
  p_id uuid,
  p_first_name text,
  p_last_name text,
  p_details jsonb,
  p_health_center_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.staff_members;
  v_after public.staff_members;
  v_details jsonb;
  v_ids uuid[];
begin
  perform public.staff_require_admin();

  select * into v_before from public.staff_members where id = p_id for update;
  if not found then
    raise exception 'staff_not_found';
  end if;

  v_details := public.staff_details_check(coalesce(p_details, '{}'::jsonb));
  v_ids := public.staff_health_centers_check(p_health_center_ids);

  update public.staff_members set
    first_name = public.staff_name(p_first_name, 'staff_invalid_name'),
    last_name = public.staff_name(p_last_name, 'staff_invalid_name'),
    profession = v_details->>'profession',
    matricula = v_details->>'matricula',
    dni = v_details->>'dni',
    phone = v_details->>'phone',
    address = v_details->>'address',
    email = v_details->>'email',
    birth_date = (v_details->>'birth_date')::date,
    hire_date = (v_details->>'hire_date')::date,
    comment = v_details->>'comment',
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id
  returning * into v_after;

  delete from public.staff_member_health_centers where staff_member_id = p_id;
  insert into public.staff_member_health_centers (staff_member_id, health_center_id)
  select p_id, unnest(v_ids);

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_member.update', 'staff_member', p_id, to_jsonb(v_before), to_jsonb(v_after), 'Edición de ficha');
end;
$$;

-- 5. RPCs de licencias ---------------------------------------------------------------------------

create or replace function public.staff_register_leave(
  p_staff_member_id uuid,
  p_kind text,
  p_starts_on date,
  p_ends_on date,
  p_days integer,
  p_hours numeric,
  p_note text,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ends date := p_ends_on;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_comment text := public.staff_text(p_comment, 500, 'staff_invalid_details');
  v_row public.staff_leaves;
begin
  perform public.staff_require_admin();

  -- Serializa las altas de la misma persona para que dos cargas simultáneas no se pisen.
  perform 1 from public.staff_members where id = p_staff_member_id and active for update;
  if not found then
    raise exception 'staff_not_found';
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
  end if;

  -- Vacaciones y otras licencias no pueden solaparse entre sí. Los permisos de horas no se
  -- bloquean por rango (ver ledger de la Tarea 1).
  if p_kind in ('vacation', 'other') and exists (
    select 1 from public.staff_leaves l
    where l.staff_member_id = p_staff_member_id
      and l.voided_at is null
      and l.kind in ('vacation', 'other')
      and daterange(l.starts_on, l.ends_on, '[]') && daterange(p_starts_on, v_ends, '[]')
  ) then
    raise exception 'staff_overlap';
  end if;

  insert into public.staff_leaves (
    staff_member_id, kind, starts_on, ends_on, days, hours, note, comment, created_by
  ) values (
    p_staff_member_id, p_kind, p_starts_on, v_ends,
    case when p_kind = 'hours_permit' then null else p_days end,
    case when p_kind = 'hours_permit' then p_hours else null end,
    v_note, v_comment, auth.uid()
  )
  returning * into v_row;
  v_id := v_row.id;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_leave.register', 'staff_leave', v_id, null, to_jsonb(v_row), 'Alta de licencia');

  return v_id;
end;
$$;

create or replace function public.staff_void_leave(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.staff_leaves;
  v_after public.staff_leaves;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public.staff_require_admin();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'staff_reason_required';
  end if;

  select * into v_before from public.staff_leaves where id = p_id for update;
  if not found then
    raise exception 'staff_not_found';
  end if;
  if v_before.voided_at is not null then
    raise exception 'staff_already_voided';
  end if;

  update public.staff_leaves set
    voided_at = now(),
    voided_by = auth.uid(),
    void_reason = v_reason
  where id = p_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (gen_random_uuid(), auth.uid(), 'staff_leave.void', 'staff_leave', p_id, to_jsonb(v_before), to_jsonb(v_after), v_reason);
end;
$$;

-- Baja y reactivación de una persona. No se borra: queda en el listado de inactivos y su historial.
create or replace function public.staff_set_member_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.staff_members;
  v_after public.staff_members;
begin
  perform public.staff_require_admin();

  select * into v_before from public.staff_members where id = p_id for update;
  if not found then
    raise exception 'staff_not_found';
  end if;
  if v_before.active = p_active then
    raise exception 'staff_no_change';
  end if;

  update public.staff_members set
    active = p_active,
    updated_at = now(),
    updated_by = auth.uid()
  where id = p_id
  returning * into v_after;

  insert into public.audit_events (operation_id, actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    gen_random_uuid(), auth.uid(),
    case when p_active then 'staff_member.reactivate' else 'staff_member.deactivate' end,
    'staff_member', p_id, to_jsonb(v_before), to_jsonb(v_after),
    case when p_active then 'Reactivación de persona' else 'Baja de persona' end
  );
end;
$$;

-- 6. Permisos de ejecución -----------------------------------------------------------------------

revoke execute on function public.staff_require_admin() from public, anon, authenticated;
revoke execute on function public.staff_text(text, integer, text) from public, anon, authenticated;
revoke execute on function public.staff_name(text, text) from public, anon, authenticated;
revoke execute on function public.staff_date(text) from public, anon, authenticated;
revoke execute on function public.staff_details_check(jsonb) from public, anon, authenticated;
revoke execute on function public.staff_health_centers_check(uuid[]) from public, anon, authenticated;

revoke execute on function public.staff_create_member(text, text, jsonb, uuid[]) from public, anon;
revoke execute on function public.staff_update_member(uuid, text, text, jsonb, uuid[]) from public, anon;
revoke execute on function public.staff_register_leave(uuid, text, date, date, integer, numeric, text, text) from public, anon;
revoke execute on function public.staff_void_leave(uuid, text) from public, anon;
revoke execute on function public.staff_set_member_active(uuid, boolean) from public, anon;
grant execute on function public.staff_set_member_active(uuid, boolean) to authenticated;

grant execute on function public.staff_create_member(text, text, jsonb, uuid[]) to authenticated;
grant execute on function public.staff_update_member(uuid, text, text, jsonb, uuid[]) to authenticated;
grant execute on function public.staff_register_leave(uuid, text, date, date, integer, numeric, text, text) to authenticated;
grant execute on function public.staff_void_leave(uuid, text) to authenticated;
