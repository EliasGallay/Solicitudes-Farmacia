-- Datos de prueba para el proyecto de DESARROLLO / PREVIEW. Solo datos ficticios.
-- NO ejecutar en producción. El workflow de migraciones la carga en develop (solo preview).
--
-- Requisitos (los crea el workflow antes de correr esta seed):
--   - Migraciones aplicadas.
--   - Usuarios de Authentication con estos emails (la seed solo les asocia perfil y datos):
--        admin@prueba.test
--        compras@prueba.test
--        centro.houssay@prueba.test
--        centro.maradona@prueba.test
--        centro.faust@prueba.test
--        movilidad@prueba.test
--
-- Todo corre en una sola transacción: si algo falla, no queda nada a medias.
-- Si la seed ya corrió, no hace nada y no duplica datos.
--
-- Qué deja:
--   - 3 centros (Houssay, Maradona, Faust), 1 admin, 1 Compras, 4 solicitantes.
--   - Productos de prueba en Farmacia, Limpieza, Laboratorio, Librería y Movilidad (tipos incluidos).
--   - Solicitudes en distintos estados: pendiente, entrega parcial, entregada con diferencia
--     pendiente de resolver, cierre con motivo, cancelada, en compras con comentario.
--   - 3 vehículos con historial de mantenimientos y reparaciones, y solicitudes de servicio
--     en distintos estados.

do $$
declare
  admin_id uuid;
  compras_id uuid;
  houssay_id uuid;
  maradona_id uuid;
  faust_id uuid;
  movilidad_id uuid;
  c_houssay uuid;
  c_maradona uuid;
  c_faust uuid;
  prod jsonb;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid;
  v1 uuid; v2 uuid; v3 uuid;
  vr1 uuid; vr2 uuid; vr3 uuid;
begin
  if exists (select 1 from public.profiles p join auth.users u on u.id = p.user_id where u.email = 'admin@prueba.test') then
    raise notice 'La seed de prueba ya corrió: no se hace nada.';
    return;
  end if;

  select id into admin_id from auth.users where email = 'admin@prueba.test';
  select id into compras_id from auth.users where email = 'compras@prueba.test';
  select id into houssay_id from auth.users where email = 'centro.houssay@prueba.test';
  select id into maradona_id from auth.users where email = 'centro.maradona@prueba.test';
  select id into faust_id from auth.users where email = 'centro.faust@prueba.test';
  select id into movilidad_id from auth.users where email = 'movilidad@prueba.test';

  if admin_id is null or compras_id is null or houssay_id is null or maradona_id is null
     or faust_id is null or movilidad_id is null then
    raise exception 'Faltan usuarios en Authentication. Crealos con los emails del encabezado y volvé a correr.';
  end if;

  -- Centros (mismos nombres ficticios que supabase/seed.sql).
  insert into public.health_centers (name) values ('Houssay'), ('Maradona'), ('Faust') on conflict (name) do nothing;
  select id into c_houssay from public.health_centers where name = 'Houssay';
  select id into c_maradona from public.health_centers where name = 'Maradona';
  select id into c_faust from public.health_centers where name = 'Faust';

  -- Perfiles.
  insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password) values
    (admin_id, 'Admin Prueba', 'admin', null, false),
    (compras_id, 'Compras Prueba', 'purchasing', null, false),
    (houssay_id, 'Centro Houssay Prueba', 'requester', c_houssay, false),
    (maradona_id, 'Centro Maradona Prueba', 'requester', c_maradona, false),
    (faust_id, 'Centro Faust Prueba', 'requester', c_faust, false),
    (movilidad_id, 'Movilidad Prueba', 'requester', c_houssay, false);

  -- Rubros y tipos de producto que todavía no existen (Farmacia y Movilidad vienen de migraciones).
  insert into public.areas (key, name) values
    ('cleaning', 'Limpieza'), ('laboratory', 'Laboratorio'), ('stationery', 'Librería')
  on conflict (key) do nothing;
  insert into public.product_types (area, key, label) values
    ('cleaning', 'detergente', 'Detergente'),
    ('cleaning', 'desinfectante', 'Desinfectante'),
    ('laboratory', 'reactivo', 'Reactivo'),
    ('laboratory', 'consumible', 'Consumible'),
    ('stationery', 'papel', 'Papel'),
    ('stationery', 'escritura', 'Escritura')
  on conflict (area, key) do nothing;

  insert into public.profile_areas (user_id, area) values
    (houssay_id, 'pharmacy'), (houssay_id, 'cleaning'),
    (maradona_id, 'pharmacy'), (maradona_id, 'laboratory'),
    (faust_id, 'stationery'),
    (movilidad_id, 'fleet');

  -- Productos de prueba.
  insert into public.products (area, name, presentation, product_type, is_test_data) values
    ('pharmacy', 'Prueba Paracetamol 500 mg', 'comprimidos x 20', 'medication', true),
    ('pharmacy', 'Prueba Jeringa 5 ml', 'unidad', 'disposable', true),
    ('pharmacy', 'Prueba Gasa estéril', 'paquete x 10', 'disposable', true),
    ('pharmacy', 'Prueba Tensiómetro', 'unidad', 'equipment', true),
    ('cleaning', 'Prueba Detergente', 'litro', 'detergente', true),
    ('cleaning', 'Prueba Desinfectante', 'litro', 'desinfectante', true),
    ('laboratory', 'Prueba Reactivo glucosa', 'kit', 'reactivo', true),
    ('laboratory', 'Prueba Tubos de ensayo', 'caja x 100', 'consumible', true),
    ('stationery', 'Prueba Papel A4', 'resma x 500', 'papel', true),
    ('stationery', 'Prueba Lápiz negro', 'unidad', 'escritura', true);

  select jsonb_object_agg(name, id) into prod from public.products where name like 'Prueba %';

  -- 1. Houssay: solicitud pendiente, sin entregas.
  perform set_config('request.jwt.claims', json_build_object('sub', houssay_id, 'role', 'authenticated')::text, true);
  r1 := public.create_request_with_items('pharmacy', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Paracetamol 500 mg', 'quantity', 20),
    jsonb_build_object('product_id', prod->>'Prueba Jeringa 5 ml', 'quantity', 100)));

  -- 2. Maradona: entrega parcial (queda pendiente).
  perform set_config('request.jwt.claims', json_build_object('sub', maradona_id, 'role', 'authenticated')::text, true);
  r2 := public.create_request_with_items('pharmacy', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Paracetamol 500 mg', 'quantity', 50),
    jsonb_build_object('product_id', prod->>'Prueba Gasa estéril', 'quantity', 30),
    jsonb_build_object('product_id', prod->>'Prueba Tensiómetro', 'quantity', 2)));

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.register_delivery(r2, jsonb_build_array(
    jsonb_build_object('request_item_id', (select id from public.request_items where request_id = r2 and product_id = (prod->>'Prueba Paracetamol 500 mg')::uuid), 'quantity', 20),
    jsonb_build_object('request_item_id', (select id from public.request_items where request_id = r2 and product_id = (prod->>'Prueba Gasa estéril')::uuid), 'quantity', 10)
  ), 'Entrega parcial de prueba');
  perform public.add_request_comment(r2, 'Entrega parcial registrada. El resto queda pendiente.');

  -- 3. Faust: entregada completa; el centro confirma con una diferencia de 2 lápices (pendiente de resolver).
  perform set_config('request.jwt.claims', json_build_object('sub', faust_id, 'role', 'authenticated')::text, true);
  r3 := public.create_request_with_items('stationery', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Papel A4', 'quantity', 10),
    jsonb_build_object('product_id', prod->>'Prueba Lápiz negro', 'quantity', 20)));

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.register_delivery(r3, jsonb_build_array(
    jsonb_build_object('request_item_id', (select id from public.request_items where request_id = r3 and product_id = (prod->>'Prueba Papel A4')::uuid), 'quantity', 10),
    jsonb_build_object('request_item_id', (select id from public.request_items where request_id = r3 and product_id = (prod->>'Prueba Lápiz negro')::uuid), 'quantity', 20)
  ), 'Remito de prueba 0001');

  perform set_config('request.jwt.claims', json_build_object('sub', faust_id, 'role', 'authenticated')::text, true);
  perform public.confirm_receipt(r3, jsonb_build_array(
    jsonb_build_object(
      'delivery_item_id', (select di.id from public.delivery_items di join public.request_items ri on ri.id = di.request_item_id where di.request_id = r3 and ri.product_id = (prod->>'Prueba Papel A4')::uuid),
      'received_quantity', 10, 'comment', null),
    jsonb_build_object(
      'delivery_item_id', (select di.id from public.delivery_items di join public.request_items ri on ri.id = di.request_item_id where di.request_id = r3 and ri.product_id = (prod->>'Prueba Lápiz negro')::uuid),
      'received_quantity', 18, 'comment', 'Faltaron 2 lápices')
  ));

  -- 4. Houssay (Limpieza): cierre parcial con motivo "sin stock".
  perform set_config('request.jwt.claims', json_build_object('sub', houssay_id, 'role', 'authenticated')::text, true);
  r4 := public.create_request_with_items('cleaning', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Detergente', 'quantity', 10),
    jsonb_build_object('product_id', prod->>'Prueba Desinfectante', 'quantity', 6)));

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.close_request_items(r4, jsonb_build_array(
    jsonb_build_object('request_item_id', (select id from public.request_items where request_id = r4 and product_id = (prod->>'Prueba Detergente')::uuid), 'quantity', 4)
  ), 'sin_stock', null);

  -- 5. Maradona (Laboratorio): solicitud cancelada por el propio centro.
  perform set_config('request.jwt.claims', json_build_object('sub', maradona_id, 'role', 'authenticated')::text, true);
  r5 := public.create_request_with_items('laboratory', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Reactivo glucosa', 'quantity', 5),
    jsonb_build_object('product_id', prod->>'Prueba Tubos de ensayo', 'quantity', 3)));
  perform public.cancel_request(r5);

  -- 6. Houssay: con requerimiento de compra y comentario de Compras.
  perform set_config('request.jwt.claims', json_build_object('sub', houssay_id, 'role', 'authenticated')::text, true);
  r6 := public.create_request_with_items('pharmacy', null, jsonb_build_array(
    jsonb_build_object('product_id', prod->>'Prueba Tensiómetro', 'quantity', 1)));

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.set_purchase_requirement(r6, 'PRUEBA-0001');

  perform set_config('request.jwt.claims', json_build_object('sub', compras_id, 'role', 'authenticated')::text, true);
  perform public.add_request_comment(r6, 'Presupuesto pedido al proveedor.');

  -- Vehículos (datos de prueba, cargados directamente como postgres).
  insert into public.vehicles (name, brand, model, year, plate, internal_code, created_by) values
    ('Camioneta Prueba', 'Toyota', 'Hilux', 2019, 'AB123CD', 'MOV-01', admin_id),
    ('Auto Prueba', 'Renault', 'Logan', 2021, 'AC456EF', 'MOV-02', admin_id),
    ('Utilitario Prueba', 'Fiat', 'Fiorino', 2017, 'AD789GH', null, admin_id);
  v1 := (select id from public.vehicles where plate = 'AB123CD');
  v2 := (select id from public.vehicles where plate = 'AC456EF');
  v3 := (select id from public.vehicles where plate = 'AD789GH');

  -- Historial de mantenimientos y reparaciones (admin).
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.add_vehicle_record(v1, 'maintenance', 'Cambio de aceite y filtros', current_date - 30, 'Taller Prueba');
  perform public.add_vehicle_record(v1, 'repair', 'Reemplazo de pastillas de freno', current_date - 10, 'Taller Prueba');
  perform public.add_vehicle_record(v2, 'maintenance', 'Service 10.000 km', current_date - 60, 'Taller Prueba');

  -- Solicitudes de servicio (Movilidad).
  perform set_config('request.jwt.claims', json_build_object('sub', movilidad_id, 'role', 'authenticated')::text, true);
  vr1 := public.create_vehicle_request(v2, 'Ruido en frenos al frenar');
  vr2 := public.create_vehicle_request(v3, 'Cambio de cubiertas delanteras');
  vr3 := public.create_vehicle_request(v1, 'Abolladura lateral');
  perform public.cancel_vehicle_request(vr3, 'Solicitud duplicada de prueba');

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform public.set_vehicle_purchase_requirement(vr2, 'FL-0001');

  perform set_config('request.jwt.claims', json_build_object('sub', movilidad_id, 'role', 'authenticated')::text, true);
  perform public.complete_vehicle_request(vr2, 'Cubiertas delanteras reemplazadas', current_date - 1, 'Gomería Prueba');

  raise notice 'Seed de prueba lista: 6 solicitudes de insumos, 3 vehículos y 3 solicitudes de servicio.';
end
$$;
