-- Búsqueda mejorada: sin distinción de acentos ni mayúsculas, por varias palabras y por
-- número de solicitud parcial. Se exponen columnas computadas de PostgREST con el texto
-- normalizado; el cliente filtra cada palabra con ilike (todas deben coincidir).
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create extension if not exists unaccent with schema extensions;

-- Normaliza texto para búsqueda: sin acentos y en minúsculas.
-- Se usa la forma con diccionario explícito para poder declararla immutable.
create or replace function public.normalize_search(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')));
$$;

-- Productos: nombre + presentación.
create or replace function public.product_search_text(product public.products)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(product.name || ' ' || product.presentation);
$$;

-- Ítems de solicitud: nombre + presentación del producto (detalle de solicitud).
create or replace function public.item_search_text(item public.request_items)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(p.name || ' ' || p.presentation)
  from public.products p
  where p.id = item.product_id;
$$;

-- Solicitudes: "sol-{número}" + nombre y presentación de todos sus productos.
create or replace function public.request_search_text(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select public.normalize_search(
    'sol-' || request.request_number || ' ' ||
    coalesce((
      select string_agg(p.name || ' ' || p.presentation, ' ')
      from public.request_items ri
      join public.products p on p.id = ri.product_id
      where ri.request_id = request.id
    ), '')
  );
$$;

-- Número de solicitud como texto, para coincidencia parcial ("2" -> 2, 12, 20, ...).
create or replace function public.request_number_text(request public.requests)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select request.request_number::text;
$$;

revoke execute on function public.normalize_search(text) from public;
revoke execute on function public.product_search_text(public.products) from public;
revoke execute on function public.item_search_text(public.request_items) from public;
revoke execute on function public.request_search_text(public.requests) from public;
revoke execute on function public.request_number_text(public.requests) from public;
grant execute on function public.normalize_search(text) to authenticated;
grant execute on function public.product_search_text(public.products) to authenticated;
grant execute on function public.item_search_text(public.request_items) to authenticated;
grant execute on function public.request_search_text(public.requests) to authenticated;
grant execute on function public.request_number_text(public.requests) to authenticated;

notify pgrst, 'reload schema';
