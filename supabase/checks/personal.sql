-- Verificación de gestión de personal (202611260001_staff.sql).
-- Autocontenida: todo ocurre dentro de una transacción que termina en rollback. Datos ficticios.
-- Cómo correrla: pegar en el SQL Editor de una base local con la migración aplicada.
-- Cada comprobación imprime "ok" o aborta con un error que indica cuál falló.

begin;

-- Usuarios ficticios: un admin y un solicitante. Se usan solo dentro de esta transacción.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a001', 'authenticated', 'authenticated', 'admin-check@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000a002', 'authenticated', 'authenticated', 'requester-check@example.test', now(), now())
on conflict (id) do nothing;

-- Usa 'purchasing' para el no-admin: 'requester' exige un centro de salud asociado.
insert into public.profiles (user_id, role, full_name)
values
  ('00000000-0000-0000-0000-00000000a001', 'admin', 'Admin de prueba'),
  ('00000000-0000-0000-0000-00000000a002', 'purchasing', 'Compras de prueba')
on conflict (user_id) do nothing;

-- Simula la sesión del admin de prueba.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;

-- 1. Alta de persona y de licencia válidas ---------------------------------------------------------
do $$
declare
  v_person uuid;
  v_leave uuid;
begin
  v_person := public.staff_create_member('Persona', 'Ficticia', '{}'::jsonb, '{}'::uuid[]);
  v_leave := public.staff_register_leave(v_person, 'vacation', date '2026-12-02', date '2026-12-06', 3, null, null, null);
  raise notice 'ok 1: alta de persona y de vacaciones con 3 días en un rango de 5';
end $$;

-- 2. Solapamiento de vacaciones se rechaza ---------------------------------------------------------
do $$
declare
  v_person uuid;
begin
  select id into v_person from public.staff_members where first_name = 'Persona' limit 1;
  begin
    perform public.staff_register_leave(v_person, 'vacation', date '2026-12-04', date '2026-12-10', 4, null, null, null);
    raise exception 'FALLO 2: se aceptó un solapamiento';
  exception when others then
    if sqlerrm <> 'staff_overlap' then raise; end if;
  end;
  raise notice 'ok 2: solapamiento de vacaciones rechazado';
end $$;

-- 3. Permiso de 2 hs se rechaza (solo 1,5 o 3) -----------------------------------------------------
do $$
declare
  v_person uuid;
begin
  select id into v_person from public.staff_members where first_name = 'Persona' limit 1;
  begin
    perform public.staff_register_leave(v_person, 'hours_permit', date '2026-12-08', null, null, 2, null, null);
    raise exception 'FALLO 3: se aceptó un permiso de 2 hs';
  exception when others then
    if sqlerrm <> 'staff_invalid_hours' then raise; end if;
  end;
  raise notice 'ok 3: permiso de 2 hs rechazado';
end $$;

-- 4. Usuario solicitante no puede registrar ni leer licencias ---------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
do $$
declare
  v_person uuid;
  v_count integer;
begin
  select id into v_person from public.staff_members where first_name = 'Persona' limit 1;
  begin
    perform public.staff_register_leave(v_person, 'hours_permit', date '2026-12-09', null, null, 1.5, null, null);
    raise exception 'FALLO 4a: un solicitante registró una licencia';
  exception when others then
    if sqlerrm <> 'staff_forbidden' then raise; end if;
  end;
  select count(*) into v_count from public.staff_leaves;
  if v_count <> 0 then
    raise exception 'FALLO 4b: un solicitante ve % licencias', v_count;
  end if;
  raise notice 'ok 4: solicitante sin acceso a licencias';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

-- 5. Anular dos veces falla y la licencia original no cambia ---------------------------------------
do $$
declare
  v_leave uuid;
  v_before timestamptz;
begin
  select id into v_leave from public.staff_leaves where kind = 'vacation' limit 1;
  perform public.staff_void_leave(v_leave, 'Carga errónea de prueba');
  select voided_at into v_before from public.staff_leaves where id = v_leave;
  begin
    perform public.staff_void_leave(v_leave, 'Segunda anulación');
    raise exception 'FALLO 5a: se anuló dos veces';
  exception when others then
    if sqlerrm <> 'staff_already_voided' then raise; end if;
  end;
  if (select voided_at from public.staff_leaves where id = v_leave) <> v_before then
    raise exception 'FALLO 5b: la anulación original cambió';
  end if;
  raise notice 'ok 5: doble anulación rechazada y registro intacto';
end $$;

-- 6. Cada alta, edición y anulación deja fila en audit_events --------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.audit_events
  where action in ('staff_member.create', 'staff_leave.register', 'staff_leave.void');
  if v_count < 3 then
    raise exception 'FALLO 6: faltan filas de auditoría (hay %)', v_count;
  end if;
  raise notice 'ok 6: auditoría registrada';
end $$;

-- 7. Baja y reactivación: cambian `active`, dejan auditoría y no borran el historial ----------------
do $$
declare
  v_person uuid;
  v_leaves_before integer;
  v_leaves_after integer;
begin
  select id into v_person from public.staff_members where first_name = 'Persona' limit 1;
  select count(*) into v_leaves_before from public.staff_leaves where staff_member_id = v_person;

  perform public.staff_set_member_active(v_person, false);
  if (select active from public.staff_members where id = v_person) then
    raise exception 'FALLO 7a: la baja no cambió active';
  end if;

  begin
    perform public.staff_set_member_active(v_person, false);
    raise exception 'FALLO 7b: se dio de baja dos veces';
  exception when others then
    if sqlerrm <> 'staff_no_change' then raise; end if;
  end;

  perform public.staff_set_member_active(v_person, true);
  select count(*) into v_leaves_after from public.staff_leaves where staff_member_id = v_person;
  if v_leaves_after <> v_leaves_before then
    raise exception 'FALLO 7c: la baja alteró el historial de licencias';
  end if;
  if (select count(*) from public.audit_events where action in ('staff_member.deactivate', 'staff_member.reactivate')) < 2 then
    raise exception 'FALLO 7d: faltan filas de auditoría de baja y reactivación';
  end if;
  raise notice 'ok 7: baja, reactivación y auditoría correctas; historial intacto';
end $$;

rollback;
