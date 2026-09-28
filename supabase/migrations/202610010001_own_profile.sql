-- Edición de los datos personales por el propio usuario (/perfil).
-- Solo el nombre: email, rol, centro y rubros los gestiona el administrador.
-- Requiere 202609300001_user_admin.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create or replace function public.update_own_profile(new_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(btrim(coalesce(new_full_name, ''))) = 0 or length(btrim(new_full_name)) > 120 then
    raise exception 'Nombre inválido' using errcode = '23514';
  end if;

  update public.profiles
  set full_name = btrim(new_full_name)
  where user_id = auth.uid()
    and active = true;
  if not found then
    raise exception 'Perfil no disponible' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_own_profile(text) from public;
grant execute on function public.update_own_profile(text) to authenticated;

notify pgrst, 'reload schema';
