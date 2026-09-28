-- Seed de productos reales (fuente: farmacia-base1.xlsx, hoja 02-06-2025).
-- Revisión y correcciones: supabase/seed/productos-borrador.csv. Todo se solicita por unidad.
-- Ejecutar en el SQL Editor del proyecto remoto, con las migraciones ya aplicadas.
-- Es idempotente: se puede volver a ejecutar sin duplicar productos.

begin;

insert into public.products (area, name, presentation, product_type, is_test_data) values
  ('pharmacy', 'Adrenalina', 'unidad', 'medication', false),
  ('pharmacy', 'Agua oxigenada', 'unidad', 'medication', false),
  ('pharmacy', 'Agua destilada', 'unidad', 'medication', false),
  ('pharmacy', 'Amiodarona', 'unidad', 'medication', false),
  ('pharmacy', 'Atropina', 'unidad', 'medication', false),
  ('pharmacy', 'Ceftriaxona', 'unidad', 'medication', false),
  ('pharmacy', 'Dexametasona', 'unidad', 'medication', false),
  ('pharmacy', 'Diazepam', 'unidad', 'medication', false),
  ('pharmacy', 'Diclofenac', 'unidad', 'medication', false),
  ('pharmacy', 'Difenhidramina', 'unidad', 'medication', false),
  ('pharmacy', 'Dipirona 2,5 g', 'unidad', 'medication', false),
  ('pharmacy', 'Furosemida', 'unidad', 'medication', false),
  ('pharmacy', 'Hidrocortisona', 'unidad', 'medication', false),
  ('pharmacy', 'Hioscina', 'unidad', 'medication', false),
  ('pharmacy', 'Ketorolac', 'unidad', 'medication', false),
  ('pharmacy', 'Lidocaína 1%', 'unidad', 'medication', false),
  ('pharmacy', 'Lidocaína 2%', 'unidad', 'medication', false),
  ('pharmacy', 'Medroxiprogesterona', 'unidad', 'medication', false),
  ('pharmacy', 'Metoclopramida 10 mg', 'unidad', 'medication', false),
  ('pharmacy', 'Penicilina benzatínica 2.400.000 UI', 'unidad', 'medication', false),
  ('pharmacy', 'Ranitidina', 'unidad', 'medication', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 16', 'unidad', 'disposable', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 18', 'unidad', 'disposable', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 20', 'unidad', 'disposable', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 22', 'unidad', 'disposable', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 23', 'unidad', 'disposable', false),
  ('pharmacy', 'Catéter IV (Abbocath) N° 24', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 25/6', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 25/5', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 25 5/8', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 25/8', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 40/8', 'unidad', 'disposable', false),
  ('pharmacy', 'Aguja 50/8', 'unidad', 'disposable', false),
  ('pharmacy', 'Alcohol', 'unidad', 'medication', false),
  ('pharmacy', 'Bajalenguas', 'unidad', 'disposable', false),
  ('pharmacy', 'Máscara de oxígeno adulto', 'unidad', 'disposable', false),
  ('pharmacy', 'Máscara de oxígeno pediátrica', 'unidad', 'disposable', false),
  ('pharmacy', 'Bisturí N° 4', 'unidad', 'disposable', false),
  ('pharmacy', 'Cepillo endocervical', 'unidad', 'disposable', false),
  ('pharmacy', 'Descartador de cortopunzantes chico', 'unidad', 'disposable', false),
  ('pharmacy', 'Dextrosa', 'unidad', 'medication', false),
  ('pharmacy', 'Equipo de suero macrogotero', 'unidad', 'disposable', false),
  ('pharmacy', 'Equipo de suero microgotero', 'unidad', 'disposable', false),
  ('pharmacy', 'Espátula de Ayre', 'unidad', 'disposable', false),
  ('pharmacy', 'Espéculo vaginal talle S', 'unidad', 'disposable', false),
  ('pharmacy', 'Espéculo vaginal talle M', 'unidad', 'disposable', false),
  ('pharmacy', 'Espéculo vaginal talle L', 'unidad', 'disposable', false),
  ('pharmacy', 'Guante de látex talle S', 'unidad', 'disposable', false),
  ('pharmacy', 'Guante de látex talle M', 'unidad', 'disposable', false),
  ('pharmacy', 'Guante de látex talle L', 'unidad', 'disposable', false),
  ('pharmacy', 'Guante de nitrilo talle S', 'unidad', 'disposable', false),
  ('pharmacy', 'Guante de nitrilo talle M', 'unidad', 'disposable', false),
  ('pharmacy', 'Hilo de sutura N° 3', 'unidad', 'disposable', false),
  ('pharmacy', 'Hilo de sutura N° 4', 'unidad', 'disposable', false),
  ('pharmacy', 'Hilo de sutura N° 5', 'unidad', 'disposable', false),
  ('pharmacy', 'Jeringa 5 ml', 'unidad', 'disposable', false),
  ('pharmacy', 'Jeringa 10 ml', 'unidad', 'disposable', false),
  ('pharmacy', 'Jeringa 20 ml', 'unidad', 'disposable', false),
  ('pharmacy', 'Nitrofurazona', 'unidad', 'medication', false),
  ('pharmacy', 'Paño de gasa', 'unidad', 'disposable', false),
  ('pharmacy', 'Papel para ECG', 'unidad', 'disposable', false),
  ('pharmacy', 'Sulfadiazina de plata (Platsul)', 'unidad', 'medication', false),
  ('pharmacy', 'Proparacaína colirio (Poencaína)', 'unidad', 'medication', false),
  ('pharmacy', 'Recolector de orina', 'unidad', 'disposable', false),
  ('pharmacy', 'Salbutamol solución para nebulizar', 'unidad', 'medication', false),
  ('pharmacy', 'Budesonida gotas', 'unidad', 'medication', false),
  ('pharmacy', 'Tela adhesiva común', 'unidad', 'disposable', false),
  ('pharmacy', 'Tela adhesiva hipoalergénica 2,5 cm', 'unidad', 'disposable', false),
  ('pharmacy', 'TPX sublingual', 'unidad', 'medication', false),
  ('pharmacy', 'Dinitrato de isosorbide sublingual (Isorbil)', 'unidad', 'medication', false),
  ('pharmacy', 'Bromuro de ipratropio', 'unidad', 'medication', false),
  ('pharmacy', 'Iodopovidona (Pervinox)', 'unidad', 'medication', false)
on conflict (area, name, presentation) do nothing;

-- Los productos ficticios del seed inicial dejan de estar disponibles para solicitar.
-- No se borran: pueden estar referenciados por solicitudes de prueba.
update public.products set active = false where is_test_data = true;

commit;

-- Verificación: 72 productos esperados.
select product_type, count(*) as productos
from public.products
where active and not is_test_data
group by product_type
order by product_type;
