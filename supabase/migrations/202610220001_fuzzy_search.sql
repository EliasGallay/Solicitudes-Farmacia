-- Búsqueda tolerante a errores de tipeo (UI-SPEC §11.1). Los acentos y mayúsculas ya se ignoran
-- (202609240006_search.sql); esto suma las palabras mal escritas: "diasepam" encuentra "Diazepam",
-- "amoxicilna" encuentra "Amoxicilina".
-- La app pide acá, para cada palabra buscada, las palabras del vocabulario parecidas y filtra con
-- "contiene la palabra o alguna parecida" sobre las mismas columnas *_search_text de siempre, así
-- la paginación y el resto de los filtros siguen resolviéndose en la base.
-- Requiere 202609240006_search.sql y 202609300001_user_admin.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create extension if not exists fuzzystrmatch with schema extensions;

-- Palabras parecidas a cada una de `tokens` (ya normalizadas con normalize_search), tomadas del
-- vocabulario de la búsqueda:
--   'productos': nombre y presentación de los productos (catálogos, solicitudes y sus ítems);
--   'tipos':     nombre de los tipos de producto;
--   'usuarios':  nombre de los usuarios (solo admin; el email no entra al vocabulario).
-- Parecida = a distancia de edición 1 (palabras de 4 a 6 letras) o 2 (7 o más), contra la palabra
-- entera o contra su comienzo, para que también funcione mientras se escribe ("diasep" -> "diazepam").
-- Las palabras de menos de 4 letras no se corrigen: habría demasiadas coincidencias.
-- Devuelve una fila por palabra buscada, con hasta 5 parecidas (las más cercanas primero).
create or replace function public.search_variants(scope text, tokens text[])
returns table (token text, variants text[])
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if scope is null or scope not in ('productos', 'tipos', 'usuarios') then
    raise exception 'busqueda-invalida';
  end if;
  if scope = 'usuarios' and public.current_app_role() is distinct from 'admin' then
    raise exception 'solo-admin';
  end if;
  if tokens is null or cardinality(tokens) = 0 then
    return;
  end if;
  if cardinality(tokens) > 6 or exists (select 1 from unnest(tokens) t where length(t) > 100) then
    raise exception 'busqueda-invalida';
  end if;

  return query
  with vocabulary as (
    select distinct word
    from (
      select public.normalize_search(p.name || ' ' || p.presentation) as source
      from public.products p
      where scope = 'productos'
      union all
      select public.normalize_search(t.label) from public.product_types t where scope = 'tipos'
      union all
      select public.normalize_search(pr.full_name) from public.profiles pr where scope = 'usuarios'
    ) texts,
    lateral regexp_split_to_table(texts.source, '[^a-z0-9]+') as word
    where length(word) >= 3
  ),
  searched as (
    select distinct t as token, case when length(t) >= 7 then 2 else 1 end as max_distance
    from unnest(tokens) t
    where length(t) >= 4
  ),
  candidates as (
    select s.token, v.word,
      least(
        extensions.levenshtein(v.word, s.token),
        extensions.levenshtein(left(v.word, length(s.token)), s.token)
      ) as distance,
      s.max_distance
    from searched s
    join vocabulary v on v.word <> s.token and abs(length(v.word) - length(s.token)) <= 20
  ),
  ranked as (
    select c.token, c.word, row_number() over (partition by c.token order by c.distance, c.word) as position
    from candidates c
    where c.distance <= c.max_distance
  )
  select r.token, array_agg(r.word order by r.position)
  from ranked r
  where r.position <= 5
  group by r.token;
end;
$$;

revoke execute on function public.search_variants(text, text[]) from public;
grant execute on function public.search_variants(text, text[]) to authenticated;
