-- Número de solicitud: secuencia global, generada por la base.
-- Se muestra como #SOL-{número} (formato solo de presentación).
-- Las solicitudes existentes se numeran por orden de creación; las nuevas continúan desde el último.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

alter table public.requests add column request_number bigint;

with ordered as (
  select id, row_number() over (order by created_at, id) as n
  from public.requests
)
update public.requests r
set request_number = o.n
from ordered o
where o.id = r.id;

alter table public.requests alter column request_number set not null;

-- generated always: el número no puede fijarse desde la API, solo lo asigna la base.
alter table public.requests alter column request_number add generated always as identity;

select setval(
  pg_get_serial_sequence('public.requests', 'request_number'),
  coalesce((select max(request_number) from public.requests), 0) + 1,
  false
);

alter table public.requests add constraint requests_request_number_key unique (request_number);

notify pgrst, 'reload schema';
