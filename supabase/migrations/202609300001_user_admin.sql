-- Gestión de usuarios por el administrador (/usuarios).
-- Las cuentas de Supabase Auth (alta, email, contraseña, bloqueo) las maneja la app desde el
-- servidor con la clave secreta. Todo lo del perfil pasa por estas funciones, que validan que
-- quien llama sea admin activo y protegen al propio admin de quitarse el acceso.
-- Requiere 202609280002_area_policies.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

-- Email y último ingreso viven en auth.users: se exponen como columnas computadas de profiles,
-- visibles solo para el admin y para el propio usuario.
create or replace function public.profile_email(profile public.profiles)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text
  from auth.users u
  where u.id = profile.user_id
    and (public.current_app_role() = 'admin' or profile.user_id = auth.uid());
$$;

create or replace function public.profile_last_sign_in_at(profile public.profiles)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select u.last_sign_in_at
  from auth.users u
  where u.id = profile.user_id
    and (public.current_app_role() = 'admin' or profile.user_id = auth.uid());
$$;

-- Búsqueda por nombre y email, sin acentos ni mayúsculas (mismo criterio que 202609240006_search.sql).
create or replace function public.profile_search_text(profile public.profiles)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.normalize_search(profile.full_name || ' ' || coalesce(public.profile_email(profile), ''));
$$;

-- True si el usuario tiene registros que impiden eliminarlo (FKs on delete restrict).
create or replace function public.profile_has_activity(profile public.profiles)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.requests where created_by = profile.user_id)
    or exists (select 1 from public.deliveries where created_by = profile.user_id)
    or exists (select 1 from public.audit_events where actor_id = profile.user_id);
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'Solo un administrador puede gestionar usuarios' using errcode = '42501';
  end if;
end;
$$;

-- Alta o edición del perfil y sus rubros, atómica. La cuenta de Auth debe existir.
-- Admin: sin centro ni rubros. Solicitante: centro y al menos un rubro existentes.
create or replace function public.admin_save_user(
  target_user_id uuid,
  new_full_name text,
  new_role public.app_role,
  new_health_center_id uuid,
  new_areas text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'La cuenta no existe' using errcode = 'P0002';
  end if;

  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'No podés quitarte el rol de administrador' using errcode = '42501';
  end if;

  if new_role = 'requester' then
    if new_health_center_id is null or not exists (select 1 from public.health_centers where id = new_health_center_id) then
      raise exception 'Centro de salud requerido' using errcode = '23514';
    end if;
    if coalesce(cardinality(new_areas), 0) = 0 then
      raise exception 'El solicitante necesita al menos un rubro' using errcode = '23514';
    end if;
    if exists (select 1 from unnest(new_areas) a where not exists (select 1 from public.areas where key = a)) then
      raise exception 'Rubro inválido' using errcode = '23503';
    end if;
  end if;

  insert into public.profiles (user_id, full_name, role, health_center_id)
  values (
    target_user_id,
    btrim(new_full_name),
    new_role,
    case when new_role = 'requester' then new_health_center_id end
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      health_center_id = excluded.health_center_id;

  delete from public.profile_areas
  where user_id = target_user_id
    and (new_role = 'admin' or area <> all(new_areas));

  if new_role = 'requester' then
    insert into public.profile_areas (user_id, area)
    select distinct target_user_id, a from unnest(new_areas) a
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.admin_set_user_active(target_user_id uuid, new_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  if target_user_id = auth.uid() and not new_active then
    raise exception 'No podés desactivar tu propia cuenta' using errcode = '42501';
  end if;

  update public.profiles set active = new_active where user_id = target_user_id;
  if not found then
    raise exception 'El usuario no existe' using errcode = 'P0002';
  end if;
end;
$$;

-- Tras asignar una contraseña temporal: el usuario debe cambiarla al ingresar.
create or replace function public.admin_require_password_change(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();

  update public.profiles set must_change_password = true where user_id = target_user_id;
  if not found then
    raise exception 'El usuario no existe' using errcode = 'P0002';
  end if;
end;
$$;

-- Elimina el perfil (y sus rubros) de un usuario sin actividad. La app elimina después la cuenta
-- de Auth. Con actividad, la baja es desactivarlo.
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.profiles;
begin
  perform public.require_admin();

  if target_user_id = auth.uid() then
    raise exception 'No podés eliminar tu propia cuenta' using errcode = '42501';
  end if;

  select * into target from public.profiles where user_id = target_user_id;
  if not found then
    raise exception 'El usuario no existe' using errcode = 'P0002';
  end if;

  if public.profile_has_activity(target) then
    raise exception 'El usuario tiene actividad registrada: desactivalo en lugar de eliminarlo' using errcode = '23503';
  end if;

  delete from public.profiles where user_id = target_user_id;
end;
$$;

revoke execute on function public.profile_email(public.profiles) from public;
revoke execute on function public.profile_last_sign_in_at(public.profiles) from public;
revoke execute on function public.profile_search_text(public.profiles) from public;
revoke execute on function public.profile_has_activity(public.profiles) from public;
revoke execute on function public.require_admin() from public;
revoke execute on function public.admin_save_user(uuid, text, public.app_role, uuid, text[]) from public;
revoke execute on function public.admin_set_user_active(uuid, boolean) from public;
revoke execute on function public.admin_require_password_change(uuid) from public;
revoke execute on function public.admin_delete_user(uuid) from public;
grant execute on function public.profile_email(public.profiles) to authenticated;
grant execute on function public.profile_last_sign_in_at(public.profiles) to authenticated;
grant execute on function public.profile_search_text(public.profiles) to authenticated;
grant execute on function public.profile_has_activity(public.profiles) to authenticated;
grant execute on function public.admin_save_user(uuid, text, public.app_role, uuid, text[]) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.admin_require_password_change(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

notify pgrst, 'reload schema';
