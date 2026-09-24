-- Tipo de producto: medicamento, descartable o equipamiento (tensiómetros, otoscopios, etc.).
-- Los productos existentes quedan como 'disposable' y el administrador los corrige desde /catalogos.
-- Luego se elimina el default: todo producto nuevo debe declarar su tipo.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

create type public.product_type as enum ('medication', 'disposable', 'equipment');

alter table public.products
  add column product_type public.product_type not null default 'disposable';

alter table public.products alter column product_type drop default;

notify pgrst, 'reload schema';
