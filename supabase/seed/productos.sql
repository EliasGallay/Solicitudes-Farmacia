-- Seed de productos reales (fuente: farmacia-base1.xlsx, hoja 02-06-2025).
-- Revisión y correcciones: supabase/seed/productos-borrador.csv. Todo se solicita por unidad.
-- Ejecutar en el SQL Editor del proyecto remoto, con las migraciones ya aplicadas.
-- Es idempotente: se puede volver a ejecutar sin duplicar productos.

begin;

insert into public.products (name, presentation, product_type, is_test_data) values
  ('Adrenalina', 'unidad', 'medication', false),
  ('Agua oxigenada', 'unidad', 'medication', false),
  ('Agua destilada', 'unidad', 'medication', false),
  ('Amiodarona', 'unidad', 'medication', false),
  ('Atropina', 'unidad', 'medication', false),
  ('Ceftriaxona', 'unidad', 'medication', false),
  ('Dexametasona', 'unidad', 'medication', false),
  ('Diazepam', 'unidad', 'medication', false),
  ('Diclofenac', 'unidad', 'medication', false),
  ('Difenhidramina', 'unidad', 'medication', false),
  ('Dipirona 2,5 g', 'unidad', 'medication', false),
  ('Furosemida', 'unidad', 'medication', false),
  ('Hidrocortisona', 'unidad', 'medication', false),
  ('Hioscina', 'unidad', 'medication', false),
  ('Ketorolac', 'unidad', 'medication', false),
  ('Lidocaína 1%', 'unidad', 'medication', false),
  ('Lidocaína 2%', 'unidad', 'medication', false),
  ('Medroxiprogesterona', 'unidad', 'medication', false),
  ('Metoclopramida 10 mg', 'unidad', 'medication', false),
  ('Penicilina benzatínica 2.400.000 UI', 'unidad', 'medication', false),
  ('Ranitidina', 'unidad', 'medication', false),
  ('Catéter IV (Abbocath) N° 16', 'unidad', 'disposable', false),
  ('Catéter IV (Abbocath) N° 18', 'unidad', 'disposable', false),
  ('Catéter IV (Abbocath) N° 20', 'unidad', 'disposable', false),
  ('Catéter IV (Abbocath) N° 22', 'unidad', 'disposable', false),
  ('Catéter IV (Abbocath) N° 23', 'unidad', 'disposable', false),
  ('Catéter IV (Abbocath) N° 24', 'unidad', 'disposable', false),
  ('Aguja 25/6', 'unidad', 'disposable', false),
  ('Aguja 25/5', 'unidad', 'disposable', false),
  ('Aguja 25 5/8', 'unidad', 'disposable', false),
  ('Aguja 25/8', 'unidad', 'disposable', false),
  ('Aguja 40/8', 'unidad', 'disposable', false),
  ('Aguja 50/8', 'unidad', 'disposable', false),
  ('Alcohol', 'unidad', 'medication', false),
  ('Bajalenguas', 'unidad', 'disposable', false),
  ('Máscara de oxígeno adulto', 'unidad', 'disposable', false),
  ('Máscara de oxígeno pediátrica', 'unidad', 'disposable', false),
  ('Bisturí N° 4', 'unidad', 'disposable', false),
  ('Cepillo endocervical', 'unidad', 'disposable', false),
  ('Descartador de cortopunzantes chico', 'unidad', 'disposable', false),
  ('Dextrosa', 'unidad', 'medication', false),
  ('Equipo de suero macrogotero', 'unidad', 'disposable', false),
  ('Equipo de suero microgotero', 'unidad', 'disposable', false),
  ('Espátula de Ayre', 'unidad', 'disposable', false),
  ('Espéculo vaginal talle S', 'unidad', 'disposable', false),
  ('Espéculo vaginal talle M', 'unidad', 'disposable', false),
  ('Espéculo vaginal talle L', 'unidad', 'disposable', false),
  ('Guante de látex talle S', 'unidad', 'disposable', false),
  ('Guante de látex talle M', 'unidad', 'disposable', false),
  ('Guante de látex talle L', 'unidad', 'disposable', false),
  ('Guante de nitrilo talle S', 'unidad', 'disposable', false),
  ('Guante de nitrilo talle M', 'unidad', 'disposable', false),
  ('Hilo de sutura N° 3', 'unidad', 'disposable', false),
  ('Hilo de sutura N° 4', 'unidad', 'disposable', false),
  ('Hilo de sutura N° 5', 'unidad', 'disposable', false),
  ('Jeringa 5 ml', 'unidad', 'disposable', false),
  ('Jeringa 10 ml', 'unidad', 'disposable', false),
  ('Jeringa 20 ml', 'unidad', 'disposable', false),
  ('Nitrofurazona', 'unidad', 'medication', false),
  ('Paño de gasa', 'unidad', 'disposable', false),
  ('Papel para ECG', 'unidad', 'disposable', false),
  ('Sulfadiazina de plata (Platsul)', 'unidad', 'medication', false),
  ('Proparacaína colirio (Poencaína)', 'unidad', 'medication', false),
  ('Recolector de orina', 'unidad', 'disposable', false),
  ('Salbutamol solución para nebulizar', 'unidad', 'medication', false),
  ('Budesonida gotas', 'unidad', 'medication', false),
  ('Tela adhesiva común', 'unidad', 'disposable', false),
  ('Tela adhesiva hipoalergénica 2,5 cm', 'unidad', 'disposable', false),
  ('TPX sublingual', 'unidad', 'medication', false),
  ('Dinitrato de isosorbide sublingual (Isorbil)', 'unidad', 'medication', false),
  ('Bromuro de ipratropio', 'unidad', 'medication', false),
  ('Iodopovidona (Pervinox)', 'unidad', 'medication', false)
on conflict (name, presentation) do nothing;

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
