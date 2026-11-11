-- Checks del rol Compras y los comentarios del historial. Requiere 202611110001_purchasing_role.sql y
-- 202611110002_purchasing_access.sql.
-- Se puede correr en el SQL Editor del proyecto de desarrollo: crea sus propios usuarios, centro,
-- producto y solicitudes dentro de una transacción que se deshace al final (rollback), así que no deja
-- datos. Resultado esperado: todas las filas empiezan con "ok". Una fila "FALLA ..." indica qué falló.

begin;

-- Actúa como el usuario indicado (rol authenticated de la API), o vuelve a postgres con null.
create function pg_temp.como(usuario uuid) returns void language plpgsql as $$
begin
  if usuario is null then
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end;
$$;

-- Ejecuta la sentencia y devuelve 'sin error', el mensaje de una excepción de las RPCs (P0001) o el
-- sqlstate de cualquier otro error (23514 check, 42501 permiso).
create function pg_temp.error_de(sentencia text) returns text language plpgsql as $$
begin
  execute sentencia;
  return 'sin error';
exception when others then
  return case when sqlstate = 'P0001' then sqlerrm else sqlstate end;
end;
$$;

create function pg_temp.chequear(caso text, obtenido text, esperado text) returns text language sql as $$
  select case when obtenido is not distinct from esperado then 'ok ' || caso
    else 'FALLA ' || caso || ': se obtuvo «' || coalesce(obtenido, 'null') || '», se esperaba «' || coalesce(esperado, 'null') || '»' end;
$$;

create temp table resultados (orden serial, resultado text);

do $$
declare
  r text[] := '{}';
  centro uuid;
  producto uuid;
  admin_id uuid := gen_random_uuid();
  compras_id uuid := gen_random_uuid();
  farmacia_id uuid := gen_random_uuid();
  sin_centro_id uuid := gen_random_uuid();
  con_req uuid;
  sin_req uuid;
  comentario uuid;
begin
  -- Datos de prueba (como postgres).
  insert into public.health_centers (name) values ('Compras check ' || gen_random_uuid()) returning id into centro;
  insert into public.products (name, presentation, area, product_type)
    select 'Producto compras check', 'Caja x 10', 'pharmacy', key from public.product_types where area = 'pharmacy' order by key limit 1
    returning id into producto;
  insert into auth.users (id, email) values (admin_id, 'admin@compras.test'), (compras_id, 'compras@compras.test'), (farmacia_id, 'farmacia@compras.test'), (sin_centro_id, 'otro@compras.test');
  insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password) values
    (admin_id, 'Admin Check', 'admin', null, false),
    (compras_id, 'Compras Check', 'purchasing', null, false),
    (farmacia_id, 'Farmacia Check', 'requester', centro, false);
  insert into public.profile_areas (user_id, area) values (farmacia_id, 'pharmacy');

  r := r || pg_temp.chequear('Compras con centro no es válido', pg_temp.error_de(format('insert into public.profiles (user_id, full_name, role, health_center_id) values (%L, %L, %L, %L)', sin_centro_id, 'Otro', 'purchasing', centro)), '23514');

  -- Alta desde la gestión de usuarios: sin centro ni rubros aunque se manden.
  perform pg_temp.como(admin_id);
  perform public.admin_save_user(sin_centro_id, 'Compras Dos', 'purchasing', centro, array['pharmacy']);
  r := r || pg_temp.chequear('el alta de Compras ignora centro', (select coalesce(health_center_id::text, 'sin centro') from public.profiles where user_id = sin_centro_id), 'sin centro');
  r := r || pg_temp.chequear('el alta de Compras ignora rubros', (select count(*)::text from public.profile_areas where user_id = sin_centro_id), '0');

  -- El centro hace dos solicitudes; el admin registra requerimiento en una sola.
  perform pg_temp.como(farmacia_id);
  con_req := public.create_request_with_items('pharmacy', null, jsonb_build_array(jsonb_build_object('product_id', producto, 'quantity', 5)));
  sin_req := public.create_request_with_items('pharmacy', null, jsonb_build_array(jsonb_build_object('product_id', producto, 'quantity', 3)));
  perform pg_temp.como(admin_id);
  perform public.set_purchase_requirement(con_req, '94020');

  -- Compras: lee solo la solicitud con requerimiento, con sus datos relacionados.
  perform pg_temp.como(compras_id);
  r := r || pg_temp.chequear('Compras ve la solicitud con requerimiento', (select count(*)::text from public.requests where id = con_req), '1');
  r := r || pg_temp.chequear('Compras no ve la solicitud sin requerimiento', (select count(*)::text from public.requests where id = sin_req), '0');
  r := r || pg_temp.chequear('Compras ve los productos pedidos', (select count(*)::text from public.request_items where request_id = con_req), '1');
  r := r || pg_temp.chequear('Compras no ve productos de otra solicitud', (select count(*)::text from public.request_items where request_id = sin_req), '0');
  r := r || pg_temp.chequear('Compras ve el nombre del producto', (select p.name from public.request_items ri join public.products p on p.id = ri.product_id where ri.request_id = con_req), 'Producto compras check');
  r := r || pg_temp.chequear('Compras ve el centro', (select count(*)::text from public.health_centers where id = centro), '1');
  r := r || pg_temp.chequear('Compras ve nombres del historial', (select string_agg(full_name, ',' order by full_name) from public.request_actor_names(con_req)), 'Admin Check,Farmacia Check');
  r := r || pg_temp.chequear('Compras no ve nombres de otra solicitud', (select count(*)::text from public.request_actor_names(sin_req)), '0');
  r := r || pg_temp.chequear('Compras no registra requerimientos', pg_temp.error_de(format('select public.set_purchase_requirement(%L, %L)', sin_req, '1')), 'sin-permiso');
  r := r || pg_temp.chequear('Compras no crea solicitudes', (pg_temp.error_de(format('select public.create_request_with_items(%L, %L, %L)', 'pharmacy', centro, jsonb_build_array(jsonb_build_object('product_id', producto, 'quantity', 1)))) <> 'sin error')::text, 'true');
  r := r || pg_temp.chequear('Compras no agrega productos a una solicitud', pg_temp.error_de(format('insert into public.request_items (request_id, product_id, requested_quantity) values (%L, %L, 1)', con_req, producto)), '42501');
  r := r || pg_temp.chequear('Compras no lee la auditoría', (select count(*)::text from public.audit_events), '0');

  -- Comentarios.
  r := r || pg_temp.chequear('comentario vacío', pg_temp.error_de(format('select public.add_request_comment(%L, %L)', con_req, '   ')), 'comentario-invalido');
  r := r || pg_temp.chequear('comentario largo', pg_temp.error_de(format('select public.add_request_comment(%L, %L)', con_req, repeat('a', 501))), 'comentario-invalido');
  r := r || pg_temp.chequear('Compras no comenta sin requerimiento', pg_temp.error_de(format('select public.add_request_comment(%L, %L)', sin_req, 'Hola')), 'solicitud-invalida');
  r := r || pg_temp.chequear('solicitud inexistente', pg_temp.error_de(format('select public.add_request_comment(%L, %L)', gen_random_uuid(), 'Hola')), 'solicitud-invalida');
  r := r || pg_temp.chequear('Compras no escribe comentarios directo', pg_temp.error_de(format('insert into public.request_comments (request_id, body, created_by) values (%L, %L, %L)', con_req, 'x', compras_id)), '42501');
  comentario := public.add_request_comment(con_req, '  Pedido al proveedor, llega el lunes  ');
  r := r || pg_temp.chequear('comentario sin espacios en los extremos', (select body from public.request_comments where id = comentario), 'Pedido al proveedor, llega el lunes');
  r := r || pg_temp.chequear('Compras ve su comentario', (select count(*)::text from public.request_comments where request_id = con_req), '1');
  r := r || pg_temp.chequear('su nombre aparece en el historial', (select count(*)::text from public.request_actor_names(con_req) where full_name = 'Compras Check'), '1');
  r := r || pg_temp.chequear('los comentarios no se editan', pg_temp.error_de(format('update public.request_comments set body = %L where id = %L', 'x', comentario)), '42501');
  r := r || pg_temp.chequear('los comentarios no se borran', pg_temp.error_de(format('delete from public.request_comments where id = %L', comentario)), '42501');

  -- El admin comenta cualquier solicitud; el centro ve los comentarios pero no comenta.
  perform pg_temp.como(admin_id);
  perform public.add_request_comment(sin_req, 'Revisar stock');
  r := r || pg_temp.chequear('el admin comenta sin requerimiento', (select count(*)::text from public.request_comments where request_id = sin_req), '1');
  perform pg_temp.como(farmacia_id);
  r := r || pg_temp.chequear('el centro ve los comentarios', (select count(*)::text from public.request_comments where request_id in (con_req, sin_req)), '2');
  r := r || pg_temp.chequear('el centro no comenta', pg_temp.error_de(format('select public.add_request_comment(%L, %L)', con_req, 'Hola')), 'sin-permiso');
  r := r || pg_temp.chequear('el centro sigue viendo sus dos solicitudes', (select count(*)::text from public.requests where id in (con_req, sin_req)), '2');

  perform pg_temp.como(null);
  r := r || pg_temp.chequear('auditoría de comentarios', (select count(*)::text from public.audit_events where action = 'request.comment' and entity_id in (con_req, sin_req)), '2');

  insert into resultados (resultado) select unnest(r);
end;
$$;

select resultado from resultados order by orden;

rollback;
