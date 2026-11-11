-- Módulo Movilidad (docs/plans/diseno-movilidad.md, docs/plans/plan-movilidad.md): vehículos de
-- Salud, su historial de mantenimientos y reparaciones, y solicitudes de servicio con requerimiento
-- de compra. Tablas propias: las solicitudes de insumos giran alrededor de ítems y cantidades.
-- Acceso por el rubro 'fleet' («Movilidad»): admin o has_area('fleet'). Toda escritura salvo el
-- ABM de vehículos (admin) pasa por las RPCs de este archivo, que validan, bloquean y auditan.
-- Requiere 202610210001_purchase_requirements.sql y 202610270001_health_center_admin.sql.
-- Verificación: supabase/checks/movilidad.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- 1. Rubro ---------------------------------------------------------------------------------------

-- Tipo de rubro: 'supplies' (insumos: catálogo, solicitudes por ítems) o 'fleet' (Movilidad). Las
-- pantallas de insumos solo muestran rubros 'supplies'.
alter table public.areas add column kind text not null default 'supplies' check (kind in ('supplies', 'fleet'));

insert into public.areas (key, name, kind) values ('fleet', 'Movilidad', 'fleet')
on conflict (key) do update set kind = 'fleet';

-- 2. Tablas --------------------------------------------------------------------------------------

-- Mismos límites que src/lib/fleet.ts. El dominio se normaliza (mayúsculas, sin espacios ni guiones)
-- en vehicles_before_write antes de validarse acá.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80 and name = btrim(name)),
  brand text not null check (length(brand) between 1 and 80 and brand = btrim(brand)),
  model text not null check (length(model) between 1 and 80 and model = btrim(model)),
  year integer not null check (year >= 1950),
  plate text not null unique check (plate ~ '^[A-Z0-9]{6,7}$'),
  internal_code text check (internal_code is null or (length(internal_code) between 1 and 30 and internal_code = btrim(internal_code))),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict
);

-- «Blanco 01» y «blanco 01» son el mismo identificador.
create unique index vehicles_internal_code_key on public.vehicles (lower(internal_code)) where internal_code is not null;

-- Numeración propia (#SRV-n), separada de las solicitudes de insumos.
create table public.vehicle_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  description text not null check (length(description) between 1 and 1000 and description = btrim(description)),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  purchase_requirement_number text check (purchase_requirement_number is null or (length(purchase_requirement_number) between 1 and 30 and purchase_requirement_number = btrim(purchase_requirement_number))),
  purchase_requirement_at timestamptz,
  purchase_requirement_by uuid references public.profiles(user_id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(user_id) on delete restrict,
  cancel_reason text check (cancel_reason is null or (length(cancel_reason) between 1 and 500 and cancel_reason = btrim(cancel_reason))),
  constraint vehicle_requests_purchase_requirement_consistent check (
    (purchase_requirement_number is null and purchase_requirement_at is null and purchase_requirement_by is null)
    or (purchase_requirement_number is not null and purchase_requirement_at is not null and purchase_requirement_by is not null)
  ),
  constraint vehicle_requests_cancel_consistent check (
    (cancelled_at is null and cancelled_by is null and cancel_reason is null)
    or (cancelled_at is not null and cancelled_by is not null and cancel_reason is not null)
  )
);
create index on public.vehicle_requests (vehicle_id, created_at desc);
create index on public.vehicle_requests (created_at desc);

-- Historial: qué se hizo (description), cuándo (performed_on) y dónde (workshop). Un registro que
-- cierra una solicitud es una reparación vinculada a ella; no se edita, se anula con motivo.
create table public.vehicle_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  kind text not null check (kind in ('maintenance', 'repair')),
  description text not null check (length(description) between 1 and 1000 and description = btrim(description)),
  performed_on date not null check (performed_on >= date '1950-01-01'),
  workshop text not null check (length(workshop) between 1 and 120 and workshop = btrim(workshop)),
  vehicle_request_id uuid references public.vehicle_requests(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles(user_id) on delete restrict,
  void_reason text check (void_reason is null or (length(void_reason) between 1 and 500 and void_reason = btrim(void_reason))),
  constraint vehicle_records_request_is_repair check (vehicle_request_id is null or kind = 'repair'),
  constraint vehicle_records_void_consistent check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);
-- Una solicitud tiene a lo sumo un cierre activo.
create unique index vehicle_records_active_request_key on public.vehicle_records (vehicle_request_id)
  where vehicle_request_id is not null and voided_at is null;
create index on public.vehicle_records (vehicle_id, performed_on desc, created_at desc);

-- 3. Columnas calculadas (PostgREST) -------------------------------------------------------------

-- Estado de la solicitud, nunca guardado: cancelada; completada si tiene un registro activo que la
-- cerró; en compras si tiene requerimiento; si no, pendiente. Anular el registro la reabre.
create or replace function public.vehicle_request_status(request public.vehicle_requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when request.cancelled_at is not null then 'cancelled'
    when exists (
      select 1 from public.vehicle_records rc
      where rc.vehicle_request_id = request.id and rc.voided_at is null
    ) then 'completed'
    when request.purchase_requirement_number is not null then 'purchase'
    else 'pending'
  end;
$$;

-- Solicitudes abiertas (pendientes o en compras) de un vehículo.
create or replace function public.vehicle_open_requests(vehicle public.vehicles)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.vehicle_requests s
  where s.vehicle_id = vehicle.id
    and public.vehicle_request_status(s) in ('pending', 'purchase');
$$;

-- Búsqueda: nombre, marca, modelo, dominio e identificador.
create or replace function public.vehicle_search_text(vehicle public.vehicles)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(concat_ws(' ', vehicle.name, vehicle.brand, vehicle.model, vehicle.plate, vehicle.internal_code));
$$;

-- Búsqueda: "srv-{número}", "req-{requerimiento}", descripción y datos del vehículo.
create or replace function public.vehicle_request_search_text(request public.vehicle_requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(concat_ws(' ',
    'srv-' || request.request_number,
    'req-' || request.purchase_requirement_number,
    request.description,
    (select concat_ws(' ', v.name, v.brand, v.model, v.plate, v.internal_code) from public.vehicles v where v.id = request.vehicle_id)
  ));
$$;

-- 4. Vehículos: normalización, reglas y auditoría ------------------------------------------------

create or replace function public.vehicles_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.plate := upper(regexp_replace(coalesce(new.plate, ''), '[\s-]', '', 'g'));
  new.internal_code := nullif(btrim(new.internal_code), '');
  if new.year > extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer + 1 then
    raise exception 'anio-invalido';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    if old.active and not new.active and exists (
      select 1 from public.vehicle_requests s
      where s.vehicle_id = old.id and public.vehicle_request_status(s) in ('pending', 'purchase')
    ) then
      raise exception 'vehiculo-con-solicitudes';
    end if;
  end if;
  return new;
end;
$$;

create trigger vehicles_before_write
before insert or update on public.vehicles
for each row execute function public.vehicles_before_write();

create or replace function public.vehicles_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  data_before jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) - 'created_at' - 'created_by' end;
  data_after jsonb := to_jsonb(new) - 'created_at' - 'created_by';
begin
  if tg_op = 'UPDATE' and data_before = data_after then
    return new;
  end if;
  perform public.write_audit(
    case
      when tg_op = 'INSERT' then 'vehicle.created'
      when old.active and not new.active then 'vehicle.deactivated'
      when not old.active and new.active then 'vehicle.activated'
      else 'vehicle.updated'
    end,
    'vehicle', new.id, data_before, data_after,
    case
      when tg_op = 'INSERT' then 'Vehículo creado'
      when old.active and not new.active then 'Vehículo desactivado'
      when not old.active and new.active then 'Vehículo activado'
      else 'Vehículo actualizado'
    end
  );
  return new;
end;
$$;

create trigger vehicles_audit
after insert or update on public.vehicles
for each row execute function public.vehicles_audit();

-- 5. Helpers internos ----------------------------------------------------------------------------

-- Bloquea la solicitud de servicio y la devuelve.
create or replace function public.lock_vehicle_request(target_request_id uuid)
returns public.vehicle_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  locked public.vehicle_requests;
begin
  select * into locked from public.vehicle_requests where id = target_request_id for update;
  if not found then
    raise exception 'solicitud-invalida';
  end if;
  return locked;
end;
$$;

-- Valida los datos de un registro del historial: qué, cuándo (no posterior a hoy en Argentina) y dónde.
create or replace function public.check_vehicle_record_input(record_description text, record_performed_on date, record_workshop text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if length(coalesce(btrim(record_description), '')) not between 1 and 1000 then
    raise exception 'descripcion-invalida';
  end if;
  if record_performed_on is null or record_performed_on < date '1950-01-01'
    or record_performed_on > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'fecha-invalida';
  end if;
  if length(coalesce(btrim(record_workshop), '')) not between 1 and 120 then
    raise exception 'taller-invalido';
  end if;
end;
$$;

-- 6. RPCs ----------------------------------------------------------------------------------------

-- Nueva solicitud de servicio para un vehículo activo. Devuelve su id.
create or replace function public.create_vehicle_request(target_vehicle_id uuid, request_description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicles;
  created public.vehicle_requests;
  clean_description text := btrim(request_description);
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  if length(coalesce(clean_description, '')) not between 1 and 1000 then
    raise exception 'descripcion-invalida';
  end if;

  -- for share: una desactivación simultánea espera y después ve la solicitud abierta.
  select * into target from public.vehicles where id = target_vehicle_id for share;
  if not found then
    raise exception 'vehiculo-invalido';
  end if;
  if not target.active then
    raise exception 'vehiculo-inactivo';
  end if;

  insert into public.vehicle_requests (vehicle_id, description, created_by)
  values (target_vehicle_id, clean_description, auth.uid())
  returning * into created;

  perform public.write_audit(
    'vehicle_request.created', 'vehicle_request', created.id, null,
    jsonb_build_object('request_number', created.request_number, 'vehicle_id', target_vehicle_id, 'description', clean_description),
    'Solicitud de servicio creada'
  );
  return created.id;
end;
$$;

-- Registra o corrige el requerimiento de compra mientras la solicitud esté abierta (solo admin).
create or replace function public.set_vehicle_purchase_requirement(target_request_id uuid, requirement_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicle_requests;
  clean_number text := nullif(btrim(requirement_number), '');
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'sin-permiso';
  end if;
  if clean_number is null or length(clean_number) > 30 then
    raise exception 'requerimiento-invalido';
  end if;

  target := public.lock_vehicle_request(target_request_id);
  if public.vehicle_request_status(target) not in ('pending', 'purchase') then
    raise exception 'solicitud-cerrada';
  end if;
  if target.purchase_requirement_number is not distinct from clean_number then
    return;
  end if;

  update public.vehicle_requests
  set purchase_requirement_number = clean_number,
      purchase_requirement_at = now(),
      purchase_requirement_by = auth.uid()
  where id = target_request_id;

  perform public.write_audit(
    'vehicle_request.purchase_requirement', 'vehicle_request', target_request_id,
    case when target.purchase_requirement_number is null then null
      else jsonb_build_object('purchase_requirement_number', target.purchase_requirement_number) end,
    jsonb_build_object('request_number', target.request_number, 'purchase_requirement_number', clean_number),
    case when target.purchase_requirement_number is null then 'Requerimiento de compra registrado'
      else 'Requerimiento de compra corregido' end
  );
end;
$$;

-- Cierra la solicitud con lo que se reparó: crea el registro de reparación vinculado en el historial
-- del vehículo. Devuelve el id del registro.
create or replace function public.complete_vehicle_request(target_request_id uuid, record_description text, record_performed_on date, record_workshop text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicle_requests;
  record_id uuid;
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  perform public.check_vehicle_record_input(record_description, record_performed_on, record_workshop);

  target := public.lock_vehicle_request(target_request_id);
  if public.vehicle_request_status(target) not in ('pending', 'purchase') then
    raise exception 'solicitud-cerrada';
  end if;
  if not exists (select 1 from public.vehicles where id = target.vehicle_id and active) then
    raise exception 'vehiculo-inactivo';
  end if;

  insert into public.vehicle_records (vehicle_id, kind, description, performed_on, workshop, vehicle_request_id, created_by)
  values (target.vehicle_id, 'repair', btrim(record_description), record_performed_on, btrim(record_workshop), target_request_id, auth.uid())
  returning id into record_id;

  perform public.write_audit(
    'vehicle_request.completed', 'vehicle_request', target_request_id, null,
    jsonb_build_object('request_number', target.request_number, 'vehicle_id', target.vehicle_id, 'record_id', record_id,
      'description', btrim(record_description), 'performed_on', record_performed_on, 'workshop', btrim(record_workshop)),
    'Solicitud de servicio completada'
  );
  return record_id;
end;
$$;

-- Cancela una solicitud abierta con motivo.
create or replace function public.cancel_vehicle_request(target_request_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicle_requests;
  clean_reason text := nullif(btrim(reason), '');
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  if clean_reason is null or length(clean_reason) > 500 then
    raise exception 'motivo-requerido';
  end if;

  target := public.lock_vehicle_request(target_request_id);
  if public.vehicle_request_status(target) not in ('pending', 'purchase') then
    raise exception 'solicitud-cerrada';
  end if;

  update public.vehicle_requests
  set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = clean_reason
  where id = target_request_id;

  perform public.write_audit(
    'vehicle_request.cancelled', 'vehicle_request', target_request_id, null,
    jsonb_build_object('request_number', target.request_number, 'vehicle_id', target.vehicle_id),
    clean_reason
  );
end;
$$;

-- Carga directa en el historial (mantenimiento de rutina o reparación sin solicitud). Devuelve su id.
create or replace function public.add_vehicle_record(target_vehicle_id uuid, record_kind text, record_description text, record_performed_on date, record_workshop text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicles;
  record_id uuid;
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  if record_kind is null or record_kind not in ('maintenance', 'repair') then
    raise exception 'registro-invalido';
  end if;
  perform public.check_vehicle_record_input(record_description, record_performed_on, record_workshop);

  select * into target from public.vehicles where id = target_vehicle_id for share;
  if not found then
    raise exception 'vehiculo-invalido';
  end if;
  if not target.active then
    raise exception 'vehiculo-inactivo';
  end if;

  insert into public.vehicle_records (vehicle_id, kind, description, performed_on, workshop, created_by)
  values (target_vehicle_id, record_kind, btrim(record_description), record_performed_on, btrim(record_workshop), auth.uid())
  returning id into record_id;

  perform public.write_audit(
    'vehicle_record.created', 'vehicle', target_vehicle_id, null,
    jsonb_build_object('record_id', record_id, 'kind', record_kind, 'description', btrim(record_description),
      'performed_on', record_performed_on, 'workshop', btrim(record_workshop)),
    'Registro cargado en el historial'
  );
  return record_id;
end;
$$;

-- Anula un registro del historial con motivo (solo admin). Si había cerrado una solicitud, la
-- solicitud vuelve a estar abierta (el estado es calculado).
create or replace function public.void_vehicle_record(target_record_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.vehicle_records;
  linked_request_id uuid;
  clean_reason text := nullif(btrim(reason), '');
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'sin-permiso';
  end if;
  if clean_reason is null or length(clean_reason) > 500 then
    raise exception 'motivo-requerido';
  end if;

  -- Mismo orden de bloqueo que complete_vehicle_request: primero la solicitud, después el registro.
  select vehicle_request_id into linked_request_id from public.vehicle_records where id = target_record_id;
  if linked_request_id is not null then
    perform public.lock_vehicle_request(linked_request_id);
  end if;
  select * into target from public.vehicle_records where id = target_record_id for update;
  if not found then
    raise exception 'registro-invalido';
  end if;
  if target.voided_at is not null then
    raise exception 'ya-anulado';
  end if;

  update public.vehicle_records
  set voided_at = now(), voided_by = auth.uid(), void_reason = clean_reason
  where id = target_record_id;

  perform public.write_audit(
    'vehicle_record.voided', 'vehicle', target.vehicle_id,
    jsonb_build_object('record_id', target.id, 'kind', target.kind, 'description', target.description,
      'performed_on', target.performed_on, 'workshop', target.workshop, 'vehicle_request_id', target.vehicle_request_id),
    null,
    clean_reason
  );
end;
$$;

-- Nombres de quienes operaron en Movilidad. profiles solo deja ver el propio perfil al solicitante.
create or replace function public.fleet_actor_names()
returns table (user_id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  return query
    with actors as (
      select created_by as actor_id from public.vehicles
      union select created_by from public.vehicle_requests
      union select purchase_requirement_by from public.vehicle_requests where purchase_requirement_by is not null
      union select cancelled_by from public.vehicle_requests where cancelled_by is not null
      union select created_by from public.vehicle_records
      union select voided_by from public.vehicle_records where voided_by is not null
    )
    select p.user_id, p.full_name from public.profiles p join actors a on a.actor_id = p.user_id;
end;
$$;

-- 7. Permisos ------------------------------------------------------------------------------------

alter table public.vehicles enable row level security;
alter table public.vehicle_requests enable row level security;
alter table public.vehicle_records enable row level security;

-- Supabase da todos los permisos por defecto a anon y authenticated: se dejan solo los necesarios.
revoke all on public.vehicles, public.vehicle_requests, public.vehicle_records from anon, authenticated;
grant select on public.vehicles, public.vehicle_requests, public.vehicle_records to authenticated;
grant insert (name, brand, model, year, plate, internal_code, active),
  update (name, brand, model, year, plate, internal_code, active) on public.vehicles to authenticated;

create policy vehicles_select_allowed on public.vehicles
for select to authenticated using (public.has_area('fleet'));
create policy vehicles_insert_admin on public.vehicles
for insert to authenticated with check (public.current_app_role() = 'admin');
create policy vehicles_update_admin on public.vehicles
for update to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy vehicle_requests_select_allowed on public.vehicle_requests
for select to authenticated using (public.has_area('fleet'));
create policy vehicle_records_select_allowed on public.vehicle_records
for select to authenticated using (public.has_area('fleet'));

-- Internas (triggers y helpers): nadie las llama desde la API.
revoke execute on function public.vehicles_before_write() from public, anon, authenticated;
revoke execute on function public.vehicles_audit() from public, anon, authenticated;
revoke execute on function public.lock_vehicle_request(uuid) from public, anon, authenticated;
revoke execute on function public.check_vehicle_record_input(text, date, text) from public, anon, authenticated;

-- Expuestas a usuarios autenticados; cada una valida el permiso por dentro.
revoke execute on function public.vehicle_request_status(public.vehicle_requests) from public, anon;
revoke execute on function public.vehicle_open_requests(public.vehicles) from public, anon;
revoke execute on function public.vehicle_search_text(public.vehicles) from public, anon;
revoke execute on function public.vehicle_request_search_text(public.vehicle_requests) from public, anon;
revoke execute on function public.create_vehicle_request(uuid, text) from public, anon;
revoke execute on function public.set_vehicle_purchase_requirement(uuid, text) from public, anon;
revoke execute on function public.complete_vehicle_request(uuid, text, date, text) from public, anon;
revoke execute on function public.cancel_vehicle_request(uuid, text) from public, anon;
revoke execute on function public.add_vehicle_record(uuid, text, text, date, text) from public, anon;
revoke execute on function public.void_vehicle_record(uuid, text) from public, anon;
revoke execute on function public.fleet_actor_names() from public, anon;
grant execute on function public.vehicle_request_status(public.vehicle_requests) to authenticated;
grant execute on function public.vehicle_open_requests(public.vehicles) to authenticated;
grant execute on function public.vehicle_search_text(public.vehicles) to authenticated;
grant execute on function public.vehicle_request_search_text(public.vehicle_requests) to authenticated;
grant execute on function public.create_vehicle_request(uuid, text) to authenticated;
grant execute on function public.set_vehicle_purchase_requirement(uuid, text) to authenticated;
grant execute on function public.complete_vehicle_request(uuid, text, date, text) to authenticated;
grant execute on function public.cancel_vehicle_request(uuid, text) to authenticated;
grant execute on function public.add_vehicle_record(uuid, text, text, date, text) to authenticated;
grant execute on function public.void_vehicle_record(uuid, text) to authenticated;
grant execute on function public.fleet_actor_names() to authenticated;

notify pgrst, 'reload schema';
