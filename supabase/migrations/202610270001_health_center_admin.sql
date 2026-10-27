-- Alta y edición de centros de salud por el administrador.
-- NO ejecutar en Supabase Cloud sin autorización explícita.
-- Un centro no se borra (perfiles y solicitudes lo referencian): se desactiva.

-- Mismo límite que CENTER_NAME_MAX en src/app/center-actions.ts.
alter table public.health_centers
  add constraint health_centers_name_length check (length(btrim(name)) <= 80);

-- Nombres únicos sin distinguir mayúsculas ni espacios en los extremos ("houssay" = "Houssay ").
create unique index if not exists health_centers_name_normalized_key
  on public.health_centers (lower(btrim(name)));

grant insert, update on public.health_centers to authenticated;

drop policy if exists health_centers_insert_admin on public.health_centers;
create policy health_centers_insert_admin on public.health_centers
for insert to authenticated
with check (public.current_app_role() = 'admin');

drop policy if exists health_centers_update_admin on public.health_centers;
create policy health_centers_update_admin on public.health_centers
for update to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');
