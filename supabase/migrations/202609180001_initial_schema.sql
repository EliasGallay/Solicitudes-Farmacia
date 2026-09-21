-- Etapa 1: estructura y políticas de denegación por defecto.
-- NO ejecutar en Supabase Cloud sin autorización explícita.
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'pharmacist');
create type public.delivery_item_status as enum ('active', 'voided');

create table public.health_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  active boolean not null default true
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) > 0),
  role public.app_role not null,
  health_center_id uuid references public.health_centers(id) on delete restrict,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pharmacist_center_required check (
    (role = 'pharmacist' and health_center_id is not null)
    or (role = 'admin' and health_center_id is null)
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  presentation text not null check (length(btrim(presentation)) > 0),
  active boolean not null default true,
  is_test_data boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, presentation)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  health_center_id uuid not null references public.health_centers(id) on delete restrict,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  closed_quantity integer not null default 0 check (closed_quantity >= 0 and closed_quantity <= requested_quantity),
  unique (request_id, product_id),
  unique (id, request_id)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, request_id)
);

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null,
  request_id uuid not null,
  request_item_id uuid not null,
  current_quantity integer not null check (current_quantity >= 0),
  status public.delivery_item_status not null default 'active',
  foreign key (delivery_id, request_id) references public.deliveries(id, request_id) on delete restrict,
  foreign key (request_item_id, request_id) references public.request_items(id, request_id) on delete restrict,
  unique (delivery_id, request_item_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  actor_id uuid not null references public.profiles(user_id) on delete restrict,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id uuid not null,
  before_data jsonb,
  after_data jsonb,
  reason text not null check (length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);

create index on public.requests (health_center_id, created_at desc);
create index on public.request_items (request_id);
create index on public.deliveries (request_id, created_at desc);
create index on public.delivery_items (request_item_id) where status = 'active';
create index on public.audit_events (entity_type, entity_id, created_at desc);

-- No policies yet: all client access is denied until the next authorized stage.
alter table public.health_centers enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;
alter table public.audit_events enable row level security;

-- Block ordinary API roles even if future grants change; stage 2 must add explicit policies.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
