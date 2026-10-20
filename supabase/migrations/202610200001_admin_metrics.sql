-- Métricas del panel del administrador (Inicio del admin): una sola RPC de lectura que agrega en la
-- base todo lo que muestran los gráficos, para no traer filas a la app.
-- Requiere 202610190001_wrong_product_receipts.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.
--
-- Período: los últimos `period_days` días (hoy inclusive, en hora de Argentina) y, para comparar,
-- el período anterior de la misma duración. Buckets diarios hasta 31 días; semanales (lunes) después.

create or replace function public.admin_dashboard_metrics(period_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  today date := (now() at time zone tz)::date;
  from_day date;
  prev_day date;
  from_ts timestamptz;
  prev_ts timestamptz;
  bucket text;
  result jsonb;
begin
  if public.current_app_role() is distinct from 'admin' then
    raise exception 'sin-permiso' using errcode = '42501';
  end if;
  if period_days is null or period_days < 7 or period_days > 366 then
    raise exception 'periodo-invalido';
  end if;

  from_day := today - (period_days - 1);
  prev_day := from_day - period_days;
  from_ts := from_day::timestamp at time zone tz;
  prev_ts := prev_day::timestamp at time zone tz;
  bucket := case when period_days <= 31 then 'day' else 'week' end;

  with
  req as (
    select r.id, r.area, r.health_center_id, r.created_at, r.created_at >= from_ts as current_period
    from public.requests r
    where r.created_at >= prev_ts
  ),
  items as (
    select i.request_id, i.product_id, i.requested_quantity, i.closed_quantity,
      public.delivered_quantity(i) as delivered, public.pending_quantity(i) as pending, req.current_period,
      req.health_center_id
    from public.request_items i
    join req on req.id = i.request_id
  ),
  active_deliveries as (
    select d.id, d.request_id, d.created_at
    from public.deliveries d
    where d.voided_at is null
  ),
  -- Horas desde la solicitud hasta su primera entrega activa.
  first_delivery as (
    select req.current_period, extract(epoch from min(d.created_at) - req.created_at) / 3600 as hours
    from req
    join active_deliveries d on d.request_id = req.id
    group by req.id, req.created_at, req.current_period
  ),
  kpis as (
    select jsonb_build_object(
      'requests', (select count(*) from req where current_period),
      'requests_prev', (select count(*) from req where not current_period),
      'deliveries', (select count(*) from active_deliveries where created_at >= from_ts),
      'deliveries_prev', (select count(*) from active_deliveries where created_at >= prev_ts and created_at < from_ts),
      'units_requested', (select coalesce(sum(requested_quantity), 0) from items where current_period),
      'units_delivered', (select coalesce(sum(delivered), 0) from items where current_period),
      'units_requested_prev', (select coalesce(sum(requested_quantity), 0) from items where not current_period),
      'units_delivered_prev', (select coalesce(sum(delivered), 0) from items where not current_period),
      'first_delivery_hours', (select percentile_cont(0.5) within group (order by hours) from first_delivery where current_period),
      'first_delivery_hours_prev', (select percentile_cont(0.5) within group (order by hours) from first_delivery where not current_period)
    ) as value
  ),
  buckets as (
    select b::date as day
    from generate_series(
      date_trunc(bucket, from_day::timestamp),
      date_trunc(bucket, today::timestamp),
      case when bucket = 'day' then interval '1 day' else interval '1 week' end
    ) b
  ),
  series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', b.day,
      'requests', (select count(*) from req where current_period and date_trunc(bucket, req.created_at at time zone tz)::date = b.day),
      'deliveries', (select count(*) from active_deliveries d where d.created_at >= from_ts and date_trunc(bucket, d.created_at at time zone tz)::date = b.day)
    ) order by b.day), '[]'::jsonb) as value
    from buckets b
  ),
  centers as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'name', h.name,
      'requests', (select count(*) from req where current_period and req.health_center_id = h.id),
      'delivered', coalesce(c.delivered, 0), 'pending', coalesce(c.pending, 0), 'closed', coalesce(c.closed, 0)
    ) order by coalesce(c.requested, 0) desc, h.name), '[]'::jsonb) as value
    from public.health_centers h
    left join (
      select health_center_id, sum(requested_quantity) as requested, sum(delivered) as delivered,
        sum(pending) as pending, sum(closed_quantity) as closed
      from items where current_period group by health_center_id
    ) c on c.health_center_id = h.id
    where h.active or c.requested is not null
  ),
  areas as (
    select coalesce(jsonb_agg(jsonb_build_object('key', a.key, 'name', a.name, 'requests', a.total) order by a.total desc, a.name), '[]'::jsonb) as value
    from (
      select a.key, a.name, count(req.id) as total
      from public.areas a
      left join req on req.area = a.key and req.current_period
      group by a.key, a.name
      having count(req.id) > 0 or bool_or(a.active)
    ) a
  ),
  top_products as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.name, 'presentation', p.presentation, 'area', p.area,
      'requested', t.requested, 'pending', t.pending, 'requests', t.requests
    ) order by t.requested desc, p.name), '[]'::jsonb) as value
    from (
      select product_id, sum(requested_quantity) as requested, sum(pending) as pending, count(*) as requests
      from items where current_period
      group by product_id
      order by sum(requested_quantity) desc
      limit 8
    ) t
    join public.products p on p.id = t.product_id
  ),
  -- Antigüedad de lo que hoy sigue con pendiente (sin importar el período): días calendario.
  aging as (
    select jsonb_build_object(
      'd0_2', count(*) filter (where days <= 2),
      'd3_6', count(*) filter (where days between 3 and 6),
      'd7_13', count(*) filter (where days between 7 and 13),
      'd14', count(*) filter (where days >= 14)
    ) as value
    from (
      select today - (r.created_at at time zone tz)::date as days
      from public.requests r
      where public.total_pending_quantity(r) > 0
    ) open_requests
  ),
  closures as (
    select coalesce(jsonb_agg(jsonb_build_object('reason', c.reason, 'units', c.units) order by c.units desc), '[]'::jsonb) as value
    from (
      select reason, sum(quantity) as units
      from public.request_item_closures
      where created_at >= from_ts
      group by reason
    ) c
  ),
  receipts as (
    select jsonb_build_object(
      'lines', count(*),
      'with_difference', count(*) filter (where received_quantity < delivered_quantity),
      'wrong_product', count(*) filter (where wrong_product),
      'voided_deliveries', (select count(*) from public.deliveries where voided_at >= from_ts)
    ) as value
    from public.delivery_item_receipts
    where created_at >= from_ts
  )
  select jsonb_build_object(
    'from', from_day, 'to', today, 'bucket', bucket,
    'kpis', kpis.value, 'series', series.value, 'centers', centers.value, 'areas', areas.value,
    'top_products', top_products.value, 'aging', aging.value, 'closures', closures.value,
    'receipts', receipts.value
  ) into result
  from kpis, series, centers, areas, top_products, aging, closures, receipts;

  return result;
end;
$$;

revoke execute on function public.admin_dashboard_metrics(integer) from public;
grant execute on function public.admin_dashboard_metrics(integer) to authenticated;
