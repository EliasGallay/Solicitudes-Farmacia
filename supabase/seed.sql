-- Solo datos ficticios. Ejecutar únicamente en un proyecto de desarrollo vacío.
insert into public.health_centers (name) values ('Houssay'), ('Maradona'), ('Faust') on conflict (name) do nothing;
insert into public.products (name, presentation, is_test_data) values
  ('Insumo ficticio A', 'unidad', true),
  ('Insumo ficticio B', 'unidad', true),
  ('Insumo ficticio C', 'unidad', true),
  ('Insumo ficticio D', 'unidad', true),
  ('Insumo ficticio E', 'unidad', true)
on conflict (name, presentation) do nothing;
