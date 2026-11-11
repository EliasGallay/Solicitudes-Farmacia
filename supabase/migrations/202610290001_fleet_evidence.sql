-- Archivos de evidencia de Movilidad (docs/plans/diseno-movilidad-adjuntos.md,
-- docs/plans/plan-movilidad-adjuntos.md): presupuestos, facturas, fotos y otra documentación adjunta a
-- una solicitud de servicio o a un registro del historial de un vehículo.
-- Requiere 202610280001_fleet.sql.
-- Verificación: supabase/checks/movilidad.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Reglas:
-- - Bucket privado `movilidad-evidencias`, en `solicitudes/<id>/<archivo>` o `registros/<id>/<archivo>`.
--   Suben el admin y los usuarios con el rubro Movilidad; ven lo mismo.
-- - Un archivo es de una solicitud o de un registro. Se registra con add_fleet_evidence después de
--   subirlo; solo quien subió el objeto puede registrarlo.
-- - Borrado lógico (deleted_at): solo quien lo subió o el admin. El archivo deja de listarse y de poder
--   leerse, pero queda en la tabla y en Storage. Solo se puede eliminar de Storage un objeto propio que
--   nunca se registró (si el registro falla después de subirlo).

-- 1. Bucket --------------------------------------------------------------------------------------

-- 10 MB por archivo (FLEET_EVIDENCE_MAX_BYTES en src/lib/fleet-evidence.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('movilidad-evidencias', 'movilidad-evidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 2. Tipos de documento --------------------------------------------------------------------------

-- Lista editable por SQL. 'other' pide un texto libre. Un tipo inactivo deja de ofrecerse pero los
-- archivos que lo usan lo conservan.
create table public.evidence_document_types (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(btrim(name)) between 1 and 60),
  sort_order integer not null,
  active boolean not null default true
);

insert into public.evidence_document_types (key, name, sort_order) values
  ('budget', 'Presupuesto', 10),
  ('invoice', 'Factura', 20),
  ('delivery_note', 'Remito', 30),
  ('work_order', 'Orden de trabajo', 40),
  ('technical_report', 'Informe técnico o diagnóstico', 50),
  ('photo_before', 'Foto antes del trabajo', 60),
  ('photo_after', 'Foto del trabajo terminado', 70),
  ('warranty', 'Garantía', 80),
  ('payment_receipt', 'Comprobante de pago', 90),
  ('other', 'Otro', 100)
on conflict (key) do nothing;

-- 3. Archivos ------------------------------------------------------------------------------------

-- Mismos límites que src/lib/fleet-evidence.ts.
create table public.fleet_evidence (
  id uuid primary key default gen_random_uuid(),
  vehicle_request_id uuid references public.vehicle_requests(id) on delete restrict,
  vehicle_record_id uuid references public.vehicle_records(id) on delete restrict,
  document_type text not null references public.evidence_document_types(key) on delete restrict,
  document_type_other text check (document_type_other is null or (length(document_type_other) between 1 and 60 and document_type_other = btrim(document_type_other))),
  storage_path text not null unique check (length(storage_path) <= 200),
  original_name text not null check (length(original_name) between 1 and 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(user_id) on delete restrict,
  constraint fleet_evidence_one_target check (num_nonnulls(vehicle_request_id, vehicle_record_id) = 1),
  constraint fleet_evidence_other_text check ((document_type = 'other') = (document_type_other is not null)),
  constraint fleet_evidence_delete_consistent check ((deleted_at is null) = (deleted_by is null))
);
create index on public.fleet_evidence (vehicle_request_id) where vehicle_request_id is not null;
create index on public.fleet_evidence (vehicle_record_id) where vehicle_record_id is not null;

-- 4. Permisos de tablas --------------------------------------------------------------------------

alter table public.evidence_document_types enable row level security;
alter table public.fleet_evidence enable row level security;

-- Supabase da todos los permisos por defecto a anon y authenticated: se deja solo lectura. Se escribe
-- con las RPCs de este archivo.
revoke all on public.evidence_document_types, public.fleet_evidence from anon, authenticated;
grant select on public.evidence_document_types, public.fleet_evidence to authenticated;

create policy evidence_document_types_select_fleet on public.evidence_document_types
for select to authenticated using (public.has_area('fleet'));

-- Los borrados no se listan para nadie.
create policy fleet_evidence_select_fleet on public.fleet_evidence
for select to authenticated using (public.has_area('fleet') and deleted_at is null);

-- 5. Storage -------------------------------------------------------------------------------------

-- True si la ruta ya está registrada (borrada o no). security definer: la política de borrado tiene que
-- ver también los registros borrados, que RLS oculta.
create or replace function public.fleet_evidence_path_registered(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.fleet_evidence where storage_path = path);
$$;

create policy movilidad_evidencias_insert_fleet on storage.objects
for insert to authenticated
with check (
  bucket_id = 'movilidad-evidencias'
  and public.has_area('fleet')
  and (storage.foldername(name))[1] in ('solicitudes', 'registros')
);

-- Se leen los archivos registrados y no borrados (RLS de fleet_evidence). Quien subió un objeto también
-- lo ve mientras no esté registrado: la API de Storage pide permiso de lectura para eliminar, y así se
-- puede limpiar un archivo cuyo registro falló.
create policy movilidad_evidencias_select_fleet on storage.objects
for select to authenticated
using (
  bucket_id = 'movilidad-evidencias'
  and public.has_area('fleet')
  and (
    exists (select 1 from public.fleet_evidence e where e.storage_path = storage.objects.name)
    or (owner_id = auth.uid()::text and not public.fleet_evidence_path_registered(name))
  )
);

create policy movilidad_evidencias_delete_unregistered on storage.objects
for delete to authenticated
using (
  bucket_id = 'movilidad-evidencias'
  and owner_id = auth.uid()::text
  and not public.fleet_evidence_path_registered(name)
);

-- 6. RPCs ----------------------------------------------------------------------------------------

-- Registra un archivo ya subido al bucket por quien llama. `target_request_id` o `target_record_id`
-- (exactamente uno). Devuelve el id del archivo.
create or replace function public.add_fleet_evidence(
  target_request_id uuid,
  target_record_id uuid,
  evidence_type text,
  evidence_type_other text,
  evidence_path text,
  evidence_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  audit_entity text;
  audit_entity_id uuid;
  uploaded storage.objects;
  uploaded_type text;
  uploaded_size bigint;
  clean_other text := case when evidence_type = 'other' then nullif(btrim(evidence_type_other), '') end;
  clean_name text := left(coalesce(nullif(btrim(evidence_name), ''), 'archivo'), 200);
  created_id uuid;
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;
  if num_nonnulls(target_request_id, target_record_id) <> 1 then
    raise exception 'archivo-invalido';
  end if;
  if not exists (select 1 from public.evidence_document_types where key = evidence_type and active) then
    raise exception 'tipo-documento-invalido';
  end if;
  if evidence_type = 'other' and (clean_other is null or length(clean_other) > 60) then
    raise exception 'tipo-documento-invalido';
  end if;

  if target_request_id is not null then
    if not exists (select 1 from public.vehicle_requests where id = target_request_id) then
      raise exception 'solicitud-invalida';
    end if;
    prefix := 'solicitudes/' || target_request_id || '/';
    audit_entity := 'vehicle_request';
    audit_entity_id := target_request_id;
  else
    select vehicle_id into audit_entity_id from public.vehicle_records where id = target_record_id;
    if not found then
      raise exception 'registro-invalido';
    end if;
    prefix := 'registros/' || target_record_id || '/';
    audit_entity := 'vehicle';
  end if;

  -- La ruta tiene que estar en la carpeta del destino (sin subcarpetas), existir, ser de quien llama y
  -- no estar registrada. Tipo y tamaño salen de lo que guardó Storage, no de lo que diga el cliente.
  if evidence_path is null or left(evidence_path, length(prefix)) <> prefix
    or length(evidence_path) = length(prefix) or position('/' in substr(evidence_path, length(prefix) + 1)) > 0 then
    raise exception 'archivo-invalido';
  end if;
  select * into uploaded from storage.objects where bucket_id = 'movilidad-evidencias' and name = evidence_path;
  if not found or uploaded.owner_id is distinct from auth.uid()::text or public.fleet_evidence_path_registered(evidence_path) then
    raise exception 'archivo-invalido';
  end if;
  uploaded_type := uploaded.metadata->>'mimetype';
  uploaded_size := (uploaded.metadata->>'size')::bigint;
  if uploaded_type is null or uploaded_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    or uploaded_size is null or uploaded_size not between 1 and 10485760 then
    raise exception 'archivo-invalido';
  end if;

  insert into public.fleet_evidence (vehicle_request_id, vehicle_record_id, document_type, document_type_other, storage_path, original_name, content_type, size_bytes, created_by)
  values (target_request_id, target_record_id, evidence_type, clean_other, evidence_path, clean_name, uploaded_type, uploaded_size, auth.uid())
  returning id into created_id;

  perform public.write_audit(
    'fleet_evidence.added', audit_entity, audit_entity_id, null,
    jsonb_build_object('evidence_id', created_id, 'vehicle_request_id', target_request_id, 'vehicle_record_id', target_record_id,
      'document_type', evidence_type, 'document_type_other', clean_other, 'name', clean_name),
    'Archivo adjuntado'
  );
  return created_id;
end;
$$;

-- Borrado lógico: quien lo subió o el admin.
create or replace function public.delete_fleet_evidence(target_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.fleet_evidence;
  audit_entity_id uuid;
begin
  if not public.has_area('fleet') then
    raise exception 'sin-permiso';
  end if;

  select * into target from public.fleet_evidence where id = target_evidence_id for update;
  if not found then
    raise exception 'archivo-invalido';
  end if;
  if target.deleted_at is not null then
    raise exception 'ya-borrado';
  end if;
  if target.created_by is distinct from auth.uid() and public.current_app_role() is distinct from 'admin' then
    raise exception 'sin-permiso';
  end if;

  update public.fleet_evidence set deleted_at = now(), deleted_by = auth.uid() where id = target_evidence_id;

  if target.vehicle_request_id is null then
    select vehicle_id into audit_entity_id from public.vehicle_records where id = target.vehicle_record_id;
  end if;
  perform public.write_audit(
    'fleet_evidence.deleted',
    case when target.vehicle_request_id is not null then 'vehicle_request' else 'vehicle' end,
    coalesce(target.vehicle_request_id, audit_entity_id),
    jsonb_build_object('evidence_id', target.id, 'vehicle_request_id', target.vehicle_request_id, 'vehicle_record_id', target.vehicle_record_id,
      'document_type', target.document_type, 'document_type_other', target.document_type_other, 'name', target.original_name),
    null,
    'Archivo borrado'
  );
end;
$$;

-- Igual que 202610280001, más quienes subieron archivos.
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
      union select created_by from public.fleet_evidence
    )
    select p.user_id, p.full_name from public.profiles p join actors a on a.actor_id = p.user_id;
end;
$$;

-- 7. Permisos de funciones -----------------------------------------------------------------------

-- La usa la política de borrado de Storage (rol authenticated): solo dice si una ruta está registrada.
revoke execute on function public.fleet_evidence_path_registered(text) from public, anon;
grant execute on function public.fleet_evidence_path_registered(text) to authenticated;

revoke execute on function public.add_fleet_evidence(uuid, uuid, text, text, text, text) from public, anon;
revoke execute on function public.delete_fleet_evidence(uuid) from public, anon;
grant execute on function public.add_fleet_evidence(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_fleet_evidence(uuid) to authenticated;

notify pgrst, 'reload schema';
