-- Prueba del workflow de migraciones: crea y borra una tabla temporal.
-- Sin efecto neto en el esquema.
create table public.ci_prueba_temporal (id integer);
drop table public.ci_prueba_temporal;
