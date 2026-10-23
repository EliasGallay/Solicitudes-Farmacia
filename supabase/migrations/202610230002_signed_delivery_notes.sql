-- Remito firmado y confirmación de recepción por el admin (docs/plans/plan-ajustes-devoluciones.md,
-- ítem 20): muchos centros no confirman la recepción en el sistema, así que el admin la confirma desde
-- la entrega adjuntando la foto (o el PDF) del remito firmado por el centro.
-- Requiere 202610190001_wrong_product_receipts.sql y 202610230001_request_edits.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Reglas:
-- - Los archivos van al bucket privado `remitos-firmados`, en `<delivery_id>/<nombre>`. Solo el admin
--   sube; los ven el admin y el centro de la solicitud (misma regla que deliveries).
-- - Una entrega puede tener varios archivos (un remito de varias hojas, o uno subido después). Nada se
--   borra: un archivo registrado queda en el historial.
-- - El admin confirma las líneas de una entrega que el centro no confirmó, con las mismas opciones que el
--   centro (conforme, con diferencia, producto equivocado). Para confirmar, la entrega tiene que tener un
--   remito firmado: el que se sube en la misma operación o uno anterior.
-- - Las líneas confirmadas por el admin guardan el remito usado (`signed_note_id`); el resto de las
--   reglas (estados, diferencias, anulación) no cambia.

-- 1. Archivos ------------------------------------------------------------------------------------

-- Límite de 5 MB (SIGNED_NOTE_MAX_BYTES en src/lib/signed-notes.ts); las fotos se comprimen en el navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('remitos-firmados', 'remitos-firmados', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table public.delivery_signed_notes (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete restrict,
  request_id uuid not null references public.requests(id) on delete restrict,
  storage_path text not null unique check (length(storage_path) <= 200),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);
create index on public.delivery_signed_notes (delivery_id, created_at);
create index on public.delivery_signed_notes (request_id);

-- Solo lectura: se escribe con confirm_receipt_with_signed_note.
alter table public.delivery_signed_notes enable row level security;
grant select on public.delivery_signed_notes to authenticated;

create policy delivery_signed_notes_select_allowed on public.delivery_signed_notes
for select to authenticated
using (
  public.current_app_role() = 'admin'
  or exists (
    select 1 from public.requests r
    where r.id = delivery_signed_notes.request_id
      and r.health_center_id = public.current_health_center_id()
      and public.has_area(r.area)
  )
);

-- Storage: el admin sube; admin y centro de la solicitud leen. El admin solo puede borrar un archivo que
-- no quedó registrado (si la confirmación falla después de subirlo).
create policy remitos_firmados_insert_admin on storage.objects
for insert to authenticated
with check (bucket_id = 'remitos-firmados' and public.current_app_role() = 'admin');

create policy remitos_firmados_select_allowed on storage.objects
for select to authenticated
using (
  bucket_id = 'remitos-firmados'
  and (
    public.current_app_role() = 'admin'
    or exists (
      select 1
      from public.delivery_signed_notes n
      join public.requests r on r.id = n.request_id
      where n.storage_path = storage.objects.name
        and r.health_center_id = public.current_health_center_id()
        and public.has_area(r.area)
    )
  )
);

create policy remitos_firmados_delete_unregistered on storage.objects
for delete to authenticated
using (
  bucket_id = 'remitos-firmados'
  and public.current_app_role() = 'admin'
  and not exists (select 1 from public.delivery_signed_notes n where n.storage_path = storage.objects.name)
);

-- 2. Recepciones confirmadas por el admin --------------------------------------------------------

alter table public.delivery_item_receipts add column signed_note_id uuid references public.delivery_signed_notes(id) on delete restrict;

-- 3. RPC -----------------------------------------------------------------------------------------

-- Registra el remito firmado de una entrega (`signed_note_path`, ya subido al bucket; null si se usa uno
-- registrado antes) y confirma las líneas de `receipt_lines` (mismo formato que confirm_receipt:
-- [{delivery_item_id, received_quantity, comment, wrong_product}]; vacío para solo adjuntar el remito).
-- Devuelve la cantidad de líneas confirmadas.
create or replace function public.confirm_receipt_with_signed_note(target_delivery_id uuid, signed_note_path text, receipt_lines jsonb default '[]'::jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.deliveries;
  file storage.objects;
  note_id uuid;
  line jsonb;
  line_id uuid;
  received integer;
  wrong boolean;
  line_comment text;
  delivered_line public.delivery_items;
  before_quantities jsonb;
  confirmed integer := 0;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  receipt_lines := coalesce(receipt_lines, '[]'::jsonb);
  if jsonb_typeof(receipt_lines) <> 'array' then
    raise exception 'cantidad-invalida';
  end if;
  if signed_note_path is null and jsonb_array_length(receipt_lines) = 0 then
    raise exception 'recepcion-vacia';
  end if;

  select * into target from public.deliveries where id = target_delivery_id;
  if not found then
    raise exception 'entrega-invalida';
  end if;
  perform public.lock_request(target.request_id);
  select * into target from public.deliveries where id = target_delivery_id for update;
  if target.voided_at is not null then
    raise exception 'entrega-anulada';
  end if;

  before_quantities := public.request_quantities(target.request_id);

  if signed_note_path is not null then
    -- El archivo tiene que estar en la carpeta de esta entrega y no estar registrado.
    if split_part(signed_note_path, '/', 1) <> target.id::text then
      raise exception 'remito-invalido';
    end if;
    select * into file from storage.objects where bucket_id = 'remitos-firmados' and name = signed_note_path;
    if not found then
      raise exception 'remito-invalido';
    end if;
    if exists (select 1 from public.delivery_signed_notes where storage_path = signed_note_path) then
      raise exception 'remito-invalido';
    end if;

    insert into public.delivery_signed_notes (delivery_id, request_id, storage_path, content_type, size_bytes, created_by)
    values (target.id, target.request_id, signed_note_path, file.metadata->>'mimetype', (file.metadata->>'size')::integer, auth.uid())
    returning id into note_id;
  else
    select id into note_id from public.delivery_signed_notes where delivery_id = target.id order by created_at desc limit 1;
    if note_id is null then
      raise exception 'remito-requerido';
    end if;
  end if;

  -- Mismas validaciones que confirm_receipt (202610190001_wrong_product_receipts.sql), sobre las líneas de
  -- esta entrega.
  for line in select * from jsonb_array_elements(receipt_lines)
  loop
    begin
      line_id := (line->>'delivery_item_id')::uuid;
      received := (line->>'received_quantity')::integer;
      wrong := coalesce((line->>'wrong_product')::boolean, false);
    exception when others then
      raise exception 'cantidad-invalida';
    end;
    line_comment := nullif(btrim(line->>'comment'), '');

    select * into delivered_line from public.delivery_items where id = line_id and delivery_id = target.id;
    if not found then
      raise exception 'item-invalido';
    end if;
    if delivered_line.status <> 'active' then
      raise exception 'entrega-anulada';
    end if;
    if exists (select 1 from public.delivery_item_receipts where delivery_item_id = line_id) then
      raise exception 'ya-confirmado';
    end if;
    if received is null or received < 0 or received > delivered_line.current_quantity then
      raise exception 'cantidad-invalida';
    end if;
    if wrong and received <> 0 then
      raise exception 'cantidad-invalida';
    end if;
    if received < delivered_line.current_quantity and line_comment is null then
      raise exception 'comentario-requerido';
    end if;
    if line_comment is not null and length(line_comment) > 500 then
      raise exception 'nota-larga';
    end if;

    insert into public.delivery_item_receipts (request_id, delivery_item_id, delivered_quantity, received_quantity, comment, wrong_product, created_by, signed_note_id)
    values (target.request_id, line_id, delivered_line.current_quantity, received, line_comment, wrong, auth.uid(), note_id);
    confirmed := confirmed + 1;
  end loop;

  if confirmed > 0 then
    -- Mismo evento que la confirmación del centro: avisa al centro (y a la diferencia, si la hay).
    perform public.write_audit(
      'delivery.received', 'request', target.request_id, before_quantities,
      jsonb_build_object('lines', receipt_lines, 'delivery_id', target.id, 'signed_note_id', note_id, 'items', public.request_quantities(target.request_id)),
      'Recepción confirmada por la administración con remito firmado'
    );
  else
    perform public.write_audit(
      'delivery.signed_note', 'delivery', target.id, null,
      jsonb_build_object('request_id', target.request_id, 'delivery_number', target.delivery_number, 'signed_note_id', note_id),
      'Remito firmado adjuntado'
    );
  end if;
  return confirmed;
end;
$$;

revoke execute on function public.confirm_receipt_with_signed_note(uuid, text, jsonb) from public;
grant execute on function public.confirm_receipt_with_signed_note(uuid, text, jsonb) to authenticated;

-- 4. Nombres para la trazabilidad: se suman quienes adjuntaron remitos firmados ----------------------

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
    select c.voided_by from public.request_item_closures c join visible v on v.id = c.request_id where c.voided_by is not null
    union
    select rc.created_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id
    union
    select rc.resolved_by from public.delivery_item_receipts rc join visible v on v.id = rc.request_id where rc.resolved_by is not null
    union
    select e.created_by from public.request_item_edits e join visible v on v.id = e.request_id
    union
    select n.created_by from public.delivery_signed_notes n join visible v on v.id = n.request_id
  )
  select p.user_id, p.full_name
  from public.profiles p
  join actors a on a.actor_id = p.user_id;
$$;

notify pgrst, 'reload schema';
