-- Seed de rubros nuevos: Librería, Laboratorio y Limpieza (docs/plans/plan-rubros.md, fase 5).
-- Fuente: catalogos-rubros-productos-solicitudes-farmacia.md (catálogo normalizado a partir de
-- órdenes de compra). Farmacia no se toca: sus productos están en productos.sql.
-- Ejecutar en el SQL Editor del proyecto remoto, con las migraciones ya aplicadas.
-- Es idempotente: se puede volver a ejecutar sin duplicar rubros, tipos ni productos.
-- Criterios: nombres sin marcas ni packaging (salvo BD Vacutainer, relevante técnicamente),
-- presentación 'unidad', productos reales y activos.

begin;

insert into public.areas (key, name) values
  ('stationery', 'Librería'),
  ('laboratory', 'Laboratorio'),
  ('cleaning', 'Limpieza')
on conflict (key) do nothing;

insert into public.product_types (area, key, label) values
  ('stationery', 'stationery_supply', 'Útiles de librería'),
  ('laboratory', 'laboratory_tube', 'Tubos'),
  ('laboratory', 'laboratory_diagnostic', 'Diagnóstico'),
  ('laboratory', 'laboratory_pipetting', 'Pipeteo'),
  ('laboratory', 'laboratory_supply', 'Otros insumos de laboratorio'),
  ('cleaning', 'cleaning_chemical', 'Productos de limpieza'),
  ('cleaning', 'hygiene', 'Higiene'),
  ('cleaning', 'cleaning_supply', 'Insumos de limpieza'),
  ('cleaning', 'cleaning_tool', 'Elementos de limpieza')
on conflict (area, key) do nothing;

insert into public.products (area, name, presentation, product_type, is_test_data) values
  -- Librería
  ('stationery', 'Resaltador de color', 'unidad', 'stationery_supply', false),
  ('stationery', 'Marcador negro', 'unidad', 'stationery_supply', false),
  ('stationery', 'Bolígrafo', 'unidad', 'stationery_supply', false),
  ('stationery', 'Cinta adhesiva 18 mm', 'unidad', 'stationery_supply', false),
  ('stationery', 'Tijera grande', 'unidad', 'stationery_supply', false),
  ('stationery', 'Tijera chica', 'unidad', 'stationery_supply', false),
  ('stationery', 'Carpeta de cartulina oficio con broche', 'unidad', 'stationery_supply', false),
  ('stationery', 'Clips de plástico', 'unidad', 'stationery_supply', false),
  ('stationery', 'Ganchos para abrochadora N° 10', 'unidad', 'stationery_supply', false),
  ('stationery', 'Abrochadora grande', 'unidad', 'stationery_supply', false),
  ('stationery', 'Regla acrílica 30 cm', 'unidad', 'stationery_supply', false),
  ('stationery', 'Corrector líquido', 'unidad', 'stationery_supply', false),
  ('stationery', 'Bibliorato oficio', 'unidad', 'stationery_supply', false),
  ('stationery', 'Adhesivo en barra', 'unidad', 'stationery_supply', false),
  -- Laboratorio
  ('laboratory', 'Tubo PP 12 × 86 mm', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tubo PP 13 × 75 mm', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tubo EDTA K3 12 × 75 mm', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tubo EDTA K3 tapa lila 13 × 75 mm', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tubo con gel + acelerador 13 × 75 mm', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tubo BD Vacutainer SST 3,5 ml tapa amarilla', 'unidad', 'laboratory_tube', false),
  ('laboratory', 'Tira para orina 10 parámetros', 'unidad', 'laboratory_diagnostic', false),
  ('laboratory', 'Tips amarillos con corona 5–200 µL', 'unidad', 'laboratory_pipetting', false),
  ('laboratory', 'Rollo térmico 57 × 30 mm', 'unidad', 'laboratory_supply', false),
  -- Limpieza: productos de limpieza
  ('cleaning', 'Lavandina 5 L', 'unidad', 'cleaning_chemical', false),
  ('cleaning', 'Detergente 5 L', 'unidad', 'cleaning_chemical', false),
  ('cleaning', 'Limpiador cremoso', 'unidad', 'cleaning_chemical', false),
  ('cleaning', 'Limpiador multiuso 5 L', 'unidad', 'cleaning_chemical', false),
  ('cleaning', 'Limpiavidrios 5 L', 'unidad', 'cleaning_chemical', false),
  ('cleaning', 'Lustramuebles aerosol', 'unidad', 'cleaning_chemical', false),
  -- Limpieza: higiene
  ('cleaning', 'Desodorante líquido 5 L', 'unidad', 'hygiene', false),
  ('cleaning', 'Desodorante de ambiente aerosol', 'unidad', 'hygiene', false),
  ('cleaning', 'Jabón líquido 5 L', 'unidad', 'hygiene', false),
  ('cleaning', 'Papel higiénico', 'unidad', 'hygiene', false),
  ('cleaning', 'Rollo de cocina', 'unidad', 'hygiene', false),
  ('cleaning', 'Toalla intercalada blanca', 'unidad', 'hygiene', false),
  -- Limpieza: insumos
  ('cleaning', 'Bolsa de residuos negra 45 × 60 cm', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Bolsa de residuos negra 60 × 90 cm', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Bolsa de residuos roja 45 × 60 cm', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Trapo de piso', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Franela de algodón', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Rejilla de algodón', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Esponja con fibra', 'unidad', 'cleaning_supply', false),
  ('cleaning', 'Esponja de acero inoxidable', 'unidad', 'cleaning_supply', false),
  -- Limpieza: elementos
  ('cleaning', 'Escobillón plástico', 'unidad', 'cleaning_tool', false),
  ('cleaning', 'Escoba plástica', 'unidad', 'cleaning_tool', false),
  ('cleaning', 'Andén barrendero 40 cm', 'unidad', 'cleaning_tool', false),
  ('cleaning', 'Balde plástico 10 L', 'unidad', 'cleaning_tool', false),
  ('cleaning', 'Cabo de madera 1,50 m', 'unidad', 'cleaning_tool', false),
  ('cleaning', 'Plumero con mango largo', 'unidad', 'cleaning_tool', false)
on conflict (area, name, presentation) do nothing;

commit;

-- Verificación: Librería 14, Laboratorio 9, Limpieza 26 productos activos.
select a.name as rubro, t.label as tipo, count(p.id) as productos
from public.areas a
join public.product_types t on t.area = a.key
left join public.products p on p.area = t.area and p.product_type = t.key and p.active and not p.is_test_data
where a.key in ('stationery', 'laboratory', 'cleaning')
group by a.name, t.label
order by a.name, t.label;
