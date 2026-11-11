-- Checks del módulo Movilidad (docs/plans/plan-movilidad.md). Requiere 202610280001_fleet.sql y
-- 202610280002_fleet_notifications.sql y 202610290001_fleet_evidence.sql.
-- Se puede correr en el SQL Editor del proyecto de desarrollo: crea sus propios usuarios, centro y
-- vehículos dentro de una transacción que se deshace al final (rollback), así que no deja datos.
-- Resultado esperado: todas las filas empiezan con "ok". Una fila "FALLA ..." indica qué falló.

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
-- sqlstate de cualquier otro error (23505 único, 23514 check, 42501 permiso).
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
  admin_id uuid := gen_random_uuid();
  movilidad_id uuid := gen_random_uuid();
  farmacia_id uuid := gen_random_uuid();
  movilidad2_id uuid := gen_random_uuid();
  rec_m uuid;
  ev1 uuid;
  ev2 uuid;
  ev3 uuid;
  -- Prefijo único por corrida para dominios e identificadores: no choca con vehículos reales.
  t text := upper(substr(md5(random()::text), 1, 4));
  v1 uuid;
  v2 uuid;
  sol uuid;
  sol2 uuid;
  reg uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  -- Datos de prueba (como postgres).
  insert into public.health_centers (name) values ('Movilidad check ' || gen_random_uuid()) returning id into centro;
  insert into auth.users (id, email) values (admin_id, 'admin@check.test'), (movilidad_id, 'movilidad@check.test'), (farmacia_id, 'farmacia@check.test'), (movilidad2_id, 'movilidad2@check.test');
  insert into public.profiles (user_id, full_name, role, health_center_id, must_change_password) values
    (admin_id, 'Admin Check', 'admin', null, false),
    (movilidad_id, 'Movilidad Check', 'requester', centro, false),
    (movilidad2_id, 'Movilidad Dos Check', 'requester', centro, false),
    (farmacia_id, 'Farmacia Check', 'requester', centro, false);
  insert into public.profile_areas (user_id, area) values (movilidad_id, 'fleet'), (movilidad2_id, 'fleet'), (farmacia_id, 'pharmacy');

  r := r || pg_temp.chequear('rubro Movilidad de tipo fleet', (select kind from public.areas where key = 'fleet'), 'fleet');
  r := r || pg_temp.chequear('rubros existentes de tipo supplies', (select kind from public.areas where key = 'pharmacy'), 'supplies');

  -- Vehículos (admin).
  perform pg_temp.como(admin_id);
  insert into public.vehicles (name, brand, model, year, plate, internal_code)
    values ('Ambulancia', 'Mercedes-Benz', 'Sprinter', 2019, lower(t) || ' 12-3', 'Check ' || t) returning id into v1;
  insert into public.vehicles (name, brand, model, year, plate)
    values ('Camioneta', 'Toyota', 'Hilux', 2015, lower(t) || '-45') returning id into v2;
  r := r || pg_temp.chequear('dominio normalizado', (select plate from public.vehicles where id = v1), t || '123');
  r := r || pg_temp.chequear('dominio viejo normalizado', (select plate from public.vehicles where id = v2), t || '45');
  r := r || pg_temp.chequear('dominio repetido', pg_temp.error_de(format('insert into public.vehicles (name, brand, model, year, plate) values (%L, %L, %L, 2020, %L)', 'Otra', 'Ford', 'Transit', t || '-1-23')), '23505');
  r := r || pg_temp.chequear('identificador repetido sin distinguir mayúsculas', pg_temp.error_de(format('insert into public.vehicles (name, brand, model, year, plate, internal_code) values (%L, %L, %L, 2020, %L, %L)', 'Otra', 'Ford', 'Transit', t || '99', lower('Check ' || t))), '23505');
  r := r || pg_temp.chequear('dominio inválido', pg_temp.error_de($q$insert into public.vehicles (name, brand, model, year, plate) values ('Otra', 'Ford', 'Transit', 2020, 'AB12')$q$), '23514');
  r := r || pg_temp.chequear('año anterior a 1950', pg_temp.error_de(format('insert into public.vehicles (name, brand, model, year, plate) values (%L, %L, %L, 1949, %L)', 'Otra', 'Ford', 'Transit', t || '88')), '23514');
  r := r || pg_temp.chequear('año posterior al siguiente', pg_temp.error_de(format('insert into public.vehicles (name, brand, model, year, plate) values (%L, %L, %L, %s, %L)', 'Otra', 'Ford', 'Transit', extract(year from hoy)::int + 2, t || '77')), 'anio-invalido');
  r := r || pg_temp.chequear('auditoría del alta', (select count(*)::text from public.audit_events where entity_id = v1 and action = 'vehicle.created'), '1');
  r := r || pg_temp.chequear('búsqueda del vehículo', (select public.vehicle_search_text(v) like '%check ' || lower(t) || '%' and public.vehicle_search_text(v) like '%' || lower(t) || '123%' from public.vehicles v where id = v1)::text, 'true');

  -- Usuario de farmacia: no ve ni opera Movilidad.
  perform pg_temp.como(farmacia_id);
  r := r || pg_temp.chequear('farmacia no ve vehículos', (select count(*)::text from public.vehicles), '0');
  r := r || pg_temp.chequear('farmacia no crea solicitudes de servicio', pg_temp.error_de(format('select public.create_vehicle_request(%L, %L)', v1, 'Ruido')), 'sin-permiso');
  r := r || pg_temp.chequear('farmacia no carga historial', pg_temp.error_de(format('select public.add_vehicle_record(%L, %L, %L, %L, %L)', v1, 'maintenance', 'Aceite', hoy, 'Taller')), 'sin-permiso');
  r := r || pg_temp.chequear('farmacia no ve nombres de Movilidad', pg_temp.error_de('select * from public.fleet_actor_names()'), 'sin-permiso');

  -- Usuario de Movilidad.
  perform pg_temp.como(movilidad_id);
  r := r || pg_temp.chequear('Movilidad ve vehículos', (select count(*)::text from public.vehicles where id in (v1, v2)), '2');
  r := r || pg_temp.chequear('Movilidad no da de alta vehículos', pg_temp.error_de(format('insert into public.vehicles (name, brand, model, year, plate) values (%L, %L, %L, 2020, %L)', 'Otra', 'Ford', 'Transit', t || '66')), '42501');
  update public.vehicles set name = 'Cambiado' where id = v1;
  r := r || pg_temp.chequear('Movilidad no edita vehículos', (select name from public.vehicles where id = v1), 'Ambulancia');
  r := r || pg_temp.chequear('Movilidad no escribe solicitudes directo', pg_temp.error_de(format('insert into public.vehicle_requests (vehicle_id, description, created_by) values (%L, %L, %L)', v1, 'x', movilidad_id)), '42501');
  r := r || pg_temp.chequear('descripción vacía', pg_temp.error_de(format('select public.create_vehicle_request(%L, %L)', v1, '   ')), 'descripcion-invalida');
  r := r || pg_temp.chequear('vehículo inexistente', pg_temp.error_de(format('select public.create_vehicle_request(%L, %L)', gen_random_uuid(), 'Ruido')), 'vehiculo-invalido');
  sol := public.create_vehicle_request(v1, '  Ruido en el tren delantero  ');
  r := r || pg_temp.chequear('solicitud creada pendiente', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol), 'pending');
  r := r || pg_temp.chequear('descripción sin espacios en los extremos', (select description from public.vehicle_requests where id = sol), 'Ruido en el tren delantero');
  r := r || pg_temp.chequear('Movilidad no carga requerimiento', pg_temp.error_de(format('select public.set_vehicle_purchase_requirement(%L, %L)', sol, '94020')), 'sin-permiso');

  -- Requerimiento de compra (admin).
  perform pg_temp.como(admin_id);
  r := r || pg_temp.chequear('requerimiento vacío', pg_temp.error_de(format('select public.set_vehicle_purchase_requirement(%L, %L)', sol, ' ')), 'requerimiento-invalido');
  perform public.set_vehicle_purchase_requirement(sol, ' 94020 ');
  r := r || pg_temp.chequear('solicitud en compras', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol), 'purchase');
  r := r || pg_temp.chequear('búsqueda por requerimiento', (select public.vehicle_request_search_text(s) like '%req-94020%' and public.vehicle_request_search_text(s) like '%srv-%' from public.vehicle_requests s where id = sol)::text, 'true');
  r := r || pg_temp.chequear('no se desactiva con solicitudes abiertas', pg_temp.error_de(format('update public.vehicles set active = false where id = %L', v1)), 'vehiculo-con-solicitudes');
  r := r || pg_temp.chequear('solicitudes abiertas del vehículo', (select public.vehicle_open_requests(v)::text from public.vehicles v where id = v1), '1');

  -- Completar (Movilidad).
  perform pg_temp.como(movilidad_id);
  r := r || pg_temp.chequear('fecha futura', pg_temp.error_de(format('select public.complete_vehicle_request(%L, %L, %L, %L)', sol, 'Pastillas', hoy + 1, 'Taller Pérez')), 'fecha-invalida');
  r := r || pg_temp.chequear('taller vacío', pg_temp.error_de(format('select public.complete_vehicle_request(%L, %L, %L, %L)', sol, 'Pastillas', hoy, '')), 'taller-invalido');
  reg := public.complete_vehicle_request(sol, 'Cambio de pastillas de freno', hoy, 'Taller Pérez');
  r := r || pg_temp.chequear('solicitud completada', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol), 'completed');
  r := r || pg_temp.chequear('registro de reparación vinculado', (select kind || ' ' || vehicle_id::text from public.vehicle_records where id = reg and vehicle_request_id = sol), 'repair ' || v1::text);
  r := r || pg_temp.chequear('completar dos veces', pg_temp.error_de(format('select public.complete_vehicle_request(%L, %L, %L, %L)', sol, 'Otra vez', hoy, 'Taller')), 'solicitud-cerrada');
  r := r || pg_temp.chequear('cancelar completada', pg_temp.error_de(format('select public.cancel_vehicle_request(%L, %L)', sol, 'Ya no')), 'solicitud-cerrada');
  r := r || pg_temp.chequear('Movilidad no anula registros', pg_temp.error_de(format('select public.void_vehicle_record(%L, %L)', reg, 'Error')), 'sin-permiso');
  r := r || pg_temp.chequear('Movilidad ve nombres de quienes operaron', (select count(*)::text from public.fleet_actor_names() where full_name in ('Admin Check', 'Movilidad Check')), '2');

  -- Anular el registro reabre la solicitud (admin).
  perform pg_temp.como(admin_id);
  r := r || pg_temp.chequear('anular sin motivo', pg_temp.error_de(format('select public.void_vehicle_record(%L, %L)', reg, ' ')), 'motivo-requerido');
  perform public.void_vehicle_record(reg, 'Cargado en otro vehículo');
  r := r || pg_temp.chequear('anulado vuelve a en compras', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol), 'purchase');
  r := r || pg_temp.chequear('anular dos veces', pg_temp.error_de(format('select public.void_vehicle_record(%L, %L)', reg, 'Otra')), 'ya-anulado');

  sol2 := public.create_vehicle_request(v2, 'Service de 10.000 km');
  reg := public.complete_vehicle_request(sol2, 'Service completo', hoy, 'Concesionario');
  perform public.void_vehicle_record(reg, 'Error de carga');
  r := r || pg_temp.chequear('anulado sin requerimiento vuelve a pendiente', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol2), 'pending');

  -- Cancelar (Movilidad).
  perform pg_temp.como(movilidad_id);
  r := r || pg_temp.chequear('cancelar sin motivo', pg_temp.error_de(format('select public.cancel_vehicle_request(%L, %L)', sol2, '')), 'motivo-requerido');
  perform public.cancel_vehicle_request(sol2, 'Se resolvió sin compra');
  r := r || pg_temp.chequear('solicitud cancelada', (select public.vehicle_request_status(s) from public.vehicle_requests s where id = sol2), 'cancelled');
  r := r || pg_temp.chequear('completar cancelada', pg_temp.error_de(format('select public.complete_vehicle_request(%L, %L, %L, %L)', sol2, 'x', hoy, 'y')), 'solicitud-cerrada');
  perform public.cancel_vehicle_request(sol, 'Se compró por otra vía');

  -- Historial directo (Movilidad).
  r := r || pg_temp.chequear('tipo de registro inválido', pg_temp.error_de(format('select public.add_vehicle_record(%L, %L, %L, %L, %L)', v1, 'otro', 'Aceite', hoy, 'Taller')), 'registro-invalido');
  perform public.add_vehicle_record(v1, 'maintenance', 'Cambio de aceite y filtros', hoy, 'Lubricentro Funes');
  r := r || pg_temp.chequear('mantenimiento cargado', (select count(*)::text from public.vehicle_records where vehicle_id = v1 and kind = 'maintenance' and vehicle_request_id is null), '1');

  -- Desactivar (admin) bloquea registros y solicitudes nuevas.
  perform pg_temp.como(admin_id);
  update public.vehicles set active = false where id = v1;
  r := r || pg_temp.chequear('vehículo desactivado', (select active::text from public.vehicles where id = v1), 'false');
  r := r || pg_temp.chequear('auditoría de la desactivación', (select count(*)::text from public.audit_events where entity_id = v1 and action = 'vehicle.deactivated'), '1');
  perform pg_temp.como(movilidad_id);
  r := r || pg_temp.chequear('inactivo no recibe registros', pg_temp.error_de(format('select public.add_vehicle_record(%L, %L, %L, %L, %L)', v1, 'maintenance', 'Aceite', hoy, 'Taller')), 'vehiculo-inactivo');
  r := r || pg_temp.chequear('inactivo no recibe solicitudes', pg_temp.error_de(format('select public.create_vehicle_request(%L, %L)', v1, 'Ruido')), 'vehiculo-inactivo');

  -- Auditoría y notificaciones (como postgres: RLS solo deja ver las propias).
  perform pg_temp.como(null);
  -- Notificaciones: admins y usuarios con Movilidad, nunca a quien hizo la operación ni a farmacia.
  r := r || pg_temp.chequear('el admin se entera de la solicitud nueva', (select count(*)::text from public.notifications where vehicle_request_id = sol and kind = 'vehicle_request.created' and recipient_id = admin_id), '1');
  r := r || pg_temp.chequear('quien pide no se notifica a sí mismo', (select count(*)::text from public.notifications where vehicle_request_id = sol and kind = 'vehicle_request.created' and recipient_id = movilidad_id), '0');
  r := r || pg_temp.chequear('Movilidad se entera del requerimiento', (select count(*)::text from public.notifications where vehicle_request_id = sol and kind = 'vehicle_request.purchase_requirement' and recipient_id = movilidad_id), '1');
  r := r || pg_temp.chequear('el admin se entera de la solicitud completada', (select count(*)::text from public.notifications where vehicle_request_id = sol and kind = 'vehicle_request.completed' and recipient_id = admin_id), '1');
  r := r || pg_temp.chequear('farmacia no recibe avisos de Movilidad', (select count(*)::text from public.notifications where vehicle_request_id in (sol, sol2) and recipient_id = farmacia_id), '0');
  r := r || pg_temp.chequear('los registros directos no notifican', (select count(*)::text from public.notifications n join public.audit_events e on e.id = n.audit_event_id where e.entity_type = 'vehicle'), '0');

  r := r || pg_temp.chequear('auditoría de la solicitud', (select string_agg(action, ',' order by created_at, action) from public.audit_events where entity_id = sol),
    'vehicle_request.cancelled,vehicle_request.completed,vehicle_request.created,vehicle_request.purchase_requirement');

  -- Permisos de las funciones: los helpers internos no se exponen a la API.
  r := r || pg_temp.chequear('helpers internos sin acceso desde la API', (
    select coalesce(string_agg(p.oid::regprocedure::text, ', '), 'ninguno')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) as roles(rol)
    where n.nspname = 'public'
      and p.proname in ('lock_vehicle_request', 'check_vehicle_record_input', 'vehicles_before_write', 'vehicles_audit', 'write_audit', 'notify_from_audit')
      and has_function_privilege(roles.rol, p.oid, 'execute')
  ), 'ninguno');
  r := r || pg_temp.chequear('RPCs sin acceso anónimo', (
    select coalesce(string_agg(p.oid::regprocedure::text, ', '), 'ninguno')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_vehicle_request', 'set_vehicle_purchase_requirement', 'complete_vehicle_request', 'cancel_vehicle_request', 'add_vehicle_record', 'void_vehicle_record', 'fleet_actor_names', 'vehicle_request_status', 'vehicle_search_text', 'vehicle_request_search_text', 'vehicle_open_requests', 'add_fleet_evidence', 'delete_fleet_evidence')
      and has_function_privilege('anon', p.oid, 'execute')
  ), 'ninguno');
  r := r || pg_temp.chequear('RPCs disponibles para usuarios', (
    select count(*)::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_vehicle_request', 'set_vehicle_purchase_requirement', 'complete_vehicle_request', 'cancel_vehicle_request', 'add_vehicle_record', 'void_vehicle_record', 'fleet_actor_names', 'vehicle_request_status', 'vehicle_search_text', 'vehicle_request_search_text', 'vehicle_open_requests', 'add_fleet_evidence', 'delete_fleet_evidence')
      and has_function_privilege('authenticated', p.oid, 'execute')
  ), '13');

  -- Archivos de evidencia (202610290001_fleet_evidence.sql). Los objetos de Storage se simulan como
  -- postgres; la app los sube por la API de Storage.
  select id into rec_m from public.vehicle_records where vehicle_id = v1 and kind = 'maintenance';
  insert into storage.objects (bucket_id, name, owner_id, metadata) values
    ('movilidad-evidencias', 'solicitudes/' || sol || '/a.pdf', movilidad_id::text, '{"mimetype": "application/pdf", "size": 1000}'),
    ('movilidad-evidencias', 'solicitudes/' || sol || '/b.pdf', admin_id::text, '{"mimetype": "application/pdf", "size": 1000}'),
    ('movilidad-evidencias', 'registros/' || rec_m || '/c.jpg', movilidad_id::text, '{"mimetype": "image/jpeg", "size": 2000}'),
    ('movilidad-evidencias', 'solicitudes/' || sol2 || '/d.pdf', movilidad_id::text, '{"mimetype": "application/pdf", "size": 1000}'),
    ('movilidad-evidencias', 'solicitudes/' || sol || '/e.html', movilidad_id::text, '{"mimetype": "text/html", "size": 10}'),
    ('movilidad-evidencias', 'solicitudes/' || sol || '/f.pdf', movilidad_id::text, '{"mimetype": "application/pdf", "size": 10485761}'),
    ('movilidad-evidencias', 'solicitudes/' || sol || '/g.pdf', movilidad2_id::text, '{"mimetype": "application/pdf", "size": 1000}'),
    ('movilidad-evidencias', 'solicitudes/' || sol || '/h.pdf', admin_id::text, '{"mimetype": "application/pdf", "size": 1000}');

  perform pg_temp.como(movilidad_id);
  ev1 := public.add_fleet_evidence(sol, null, 'budget', 'se ignora', 'solicitudes/' || sol || '/a.pdf', 'presupuesto.pdf');
  r := r || pg_temp.chequear('archivo registrado en la solicitud', (select document_type || ' ' || coalesce(document_type_other, 'null') || ' ' || original_name from public.fleet_evidence where id = ev1), 'budget null presupuesto.pdf');
  r := r || pg_temp.chequear('«Otro» sin texto', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, %L, %L, %L)', sol, 'other', ' ', 'solicitudes/' || sol || '/b.pdf', 'x.pdf')), 'tipo-documento-invalido');
  r := r || pg_temp.chequear('tipo inexistente', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'nada', 'solicitudes/' || sol || '/b.pdf', 'x.pdf')), 'tipo-documento-invalido');
  r := r || pg_temp.chequear('ruta de otra solicitud', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol2 || '/d.pdf', 'x.pdf')), 'archivo-invalido');
  r := r || pg_temp.chequear('ruta inexistente en Storage', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol || '/zzz.pdf', 'x.pdf')), 'archivo-invalido');
  r := r || pg_temp.chequear('tipo de archivo no permitido', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol || '/e.html', 'x.html')), 'archivo-invalido');
  r := r || pg_temp.chequear('archivo de más de 10 MB', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol || '/f.pdf', 'x.pdf')), 'archivo-invalido');
  r := r || pg_temp.chequear('sin destino', pg_temp.error_de(format('select public.add_fleet_evidence(null, null, %L, null, %L, %L)', 'invoice', 'solicitudes/' || sol || '/b.pdf', 'x.pdf')), 'archivo-invalido');
  r := r || pg_temp.chequear('dos destinos', pg_temp.error_de(format('select public.add_fleet_evidence(%L, %L, %L, null, %L, %L)', sol, rec_m, 'invoice', 'solicitudes/' || sol || '/b.pdf', 'x.pdf')), 'archivo-invalido');
  r := r || pg_temp.chequear('registrar dos veces el mismo archivo', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol || '/a.pdf', 'x.pdf')), 'archivo-invalido');
  ev3 := public.add_fleet_evidence(null, rec_m, 'other', '  Foto del tablero  ', 'registros/' || rec_m || '/c.jpg', 'tablero.jpg');
  r := r || pg_temp.chequear('«Otro» con texto en un registro de vehículo inactivo', (select document_type_other from public.fleet_evidence where id = ev3), 'Foto del tablero');

  perform pg_temp.como(admin_id);
  ev2 := public.add_fleet_evidence(sol, null, 'invoice', null, 'solicitudes/' || sol || '/b.pdf', 'factura.pdf');

  perform pg_temp.como(movilidad2_id);
  r := r || pg_temp.chequear('otro usuario de Movilidad ve los archivos', (select count(*)::text from public.fleet_evidence where vehicle_request_id = sol), '2');
  r := r || pg_temp.chequear('no registra un archivo que subió otro', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol2 || '/d.pdf', 'x.pdf')), 'archivo-invalido');
  perform public.add_fleet_evidence(sol, null, 'photo_after', null, 'solicitudes/' || sol || '/g.pdf', 'foto.pdf');
  perform pg_temp.como(movilidad_id);
  r := r || pg_temp.chequear('ve el nombre de quien solo subió un archivo', (select count(*)::text from public.fleet_actor_names() where full_name = 'Movilidad Dos Check'), '1');
  perform pg_temp.como(movilidad2_id);
  r := r || pg_temp.chequear('no borra lo que subió otro', pg_temp.error_de(format('select public.delete_fleet_evidence(%L)', ev1)), 'sin-permiso');
  r := r || pg_temp.chequear('no borra lo que subió el admin', pg_temp.error_de(format('select public.delete_fleet_evidence(%L)', ev2)), 'sin-permiso');

  perform pg_temp.como(movilidad_id);
  perform public.delete_fleet_evidence(ev1);
  r := r || pg_temp.chequear('borrar dos veces', pg_temp.error_de(format('select public.delete_fleet_evidence(%L)', ev1)), 'ya-borrado');
  r := r || pg_temp.chequear('el borrado no se lista', (select count(*)::text from public.fleet_evidence where vehicle_request_id = sol), '2');
  r := r || pg_temp.chequear('Storage no deja leer el borrado', (select count(*)::text from storage.objects where bucket_id = 'movilidad-evidencias' and name = 'solicitudes/' || sol || '/a.pdf'), '0');
  r := r || pg_temp.chequear('Storage deja leer el registrado', (select count(*)::text from storage.objects where bucket_id = 'movilidad-evidencias' and name = 'solicitudes/' || sol || '/b.pdf'), '1');
  r := r || pg_temp.chequear('quien subió ve su archivo sin registrar', (select count(*)::text from storage.objects where bucket_id = 'movilidad-evidencias' and name = 'solicitudes/' || sol2 || '/d.pdf'), '1');
  r := r || pg_temp.chequear('Storage no deja leer lo no registrado de otro', (select count(*)::text from storage.objects where bucket_id = 'movilidad-evidencias' and name = 'solicitudes/' || sol || '/h.pdf'), '0');

  perform pg_temp.como(admin_id);
  perform public.delete_fleet_evidence(ev3);
  r := r || pg_temp.chequear('el admin borra lo de otro', (select count(*)::text from public.fleet_evidence where id = ev3), '0');

  perform pg_temp.como(farmacia_id);
  r := r || pg_temp.chequear('farmacia no ve archivos', (select count(*)::text from public.fleet_evidence), '0');
  r := r || pg_temp.chequear('farmacia no lee Storage', (select count(*)::text from storage.objects where bucket_id = 'movilidad-evidencias'), '0');
  r := r || pg_temp.chequear('farmacia no sube', pg_temp.error_de(format('select public.add_fleet_evidence(%L, null, %L, null, %L, %L)', sol, 'invoice', 'solicitudes/' || sol || '/b.pdf', 'x.pdf')), 'sin-permiso');

  perform pg_temp.como(null);
  r := r || pg_temp.chequear('el borrado es lógico', (select count(*)::text || ' ' || count(deleted_at)::text from public.fleet_evidence where id in (ev1, ev2, ev3)), '3 2');
  r := r || pg_temp.chequear('auditoría de archivos', (select string_agg(action, ',' order by action) from public.audit_events where action like 'fleet_evidence.%' and actor_id in (admin_id, movilidad_id, movilidad2_id)), 'fleet_evidence.added,fleet_evidence.added,fleet_evidence.added,fleet_evidence.added,fleet_evidence.deleted,fleet_evidence.deleted');
  r := r || pg_temp.chequear('los archivos no notifican', (select count(*)::text from public.notifications n join public.audit_events e on e.id = n.audit_event_id where e.action like 'fleet_evidence.%'), '0');
  r := r || pg_temp.chequear('tipos de documento cargados', (select string_agg(key, ',' order by sort_order) from public.evidence_document_types), 'budget,invoice,delivery_note,work_order,technical_report,photo_before,photo_after,warranty,payment_receipt,other');

  insert into resultados (resultado) select unnest(r);
end;
$$;

select resultado from resultados order by orden;

rollback;
