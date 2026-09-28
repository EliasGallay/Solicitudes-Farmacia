-- Solo datos ficticios. Ejecutar únicamente en un proyecto de desarrollo vacío.
insert into public.health_centers (name) values ('Houssay'), ('Maradona'), ('Faust') on conflict (name) do nothing;
insert into public.products (area, name, presentation, product_type, is_test_data) values
  ('pharmacy', 'Insumo ficticio A', 'unidad', 'disposable', true),
  ('pharmacy', 'Insumo ficticio B', 'unidad', 'disposable', true),
  ('pharmacy', 'Insumo ficticio C', 'unidad', 'disposable', true),
  ('pharmacy', 'Insumo ficticio D', 'unidad', 'disposable', true),
  ('pharmacy', 'Insumo ficticio E', 'unidad', 'disposable', true)
on conflict (area, name, presentation) do nothing;
