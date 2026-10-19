-- Actividad diaria para que Supabase (plan gratuito) no pause el proyecto por inactividad.
-- La llama una vez por día la ruta /api/cron/keepalive (Vercel Cron, vercel.json), con la clave secreta.
-- Aplicar en el SQL Editor de cada proyecto que se quiera mantener activo.
--
-- No toca ninguna tabla de la aplicación: el ciclo completo (alta, lectura, modificación y baja) se
-- hace sobre public.keepalive_pings, que la app no usa. Se conserva una semana de registros para
-- poder verificar que el cron corre; a partir del octavo día cada llamada borra el más viejo.

create table public.keepalive_pings (
  id bigint generated always as identity primary key,
  source text not null default 'vercel-cron' check (length(source) <= 100),
  created_at timestamptz not null default now(),
  checked_at timestamptz
);

-- RLS sin políticas y sin permisos para la API: solo la escribe la función de abajo.
alter table public.keepalive_pings enable row level security;
revoke all on public.keepalive_pings from anon, authenticated;

create or replace function public.keepalive_ping(ping_source text default 'vercel-cron')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  total integer;
  removed integer;
begin
  -- Alta.
  insert into public.keepalive_pings (source)
  values (left(coalesce(nullif(btrim(ping_source), ''), 'vercel-cron'), 100))
  returning id into new_id;

  -- Lectura.
  select count(*) into total from public.keepalive_pings;

  -- Modificación.
  update public.keepalive_pings set checked_at = now() where id = new_id;

  -- Baja: lo anterior a una semana.
  delete from public.keepalive_pings where created_at < now() - interval '7 days';
  get diagnostics removed = row_count;

  return jsonb_build_object('id', new_id, 'rows', total, 'deleted', removed, 'at', now());
end;
$$;

-- Solo con la clave secreta (rol service_role): ni anónimos ni usuarios de la app pueden llamarla.
revoke execute on function public.keepalive_ping(text) from public, anon, authenticated;
grant execute on function public.keepalive_ping(text) to service_role;

notify pgrst, 'reload schema';
