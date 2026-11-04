-- Avatar Access core schema (Supabase / Postgres)
create extension if not exists "uuid-ossp";

create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  hubspot_company_id text unique,
  name text not null,
  kind text check (kind in ('gc','owner','design_firm','subcontractor','other')),
  park_owner text,               -- Disney | Universal | SeaWorld | null
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id),
  name text not null,
  site_address text,
  jurisdiction text,             -- permitting AHJ, e.g. CFTOD, Orange County
  owner_rules text,              -- link to owner scaffold standards doc
  created_at timestamptz default now()
);

create table if not exists bids (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id),
  hubspot_deal_id text unique,
  source text,                   -- email | portal | referral
  received_at timestamptz default now(),
  due_at timestamptz,
  scope_text text,
  drive_folder text,
  status text default 'received'
    check (status in ('received','qualified','no_bid','estimating','proposed','won','lost')),
  qualification jsonb            -- output of bid-intake
);

create table if not exists estimates (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid references bids(id),
  revision int default 1,
  status text default 'queued'
    check (status in ('queued','draft','review','approved','sent','superseded')),
  estimate jsonb not null,       -- schema: cost-model/references/estimate-schema.md
  created_at timestamptz default now()
);

create table if not exists models (
  id uuid primary key default uuid_generate_v4(),
  bid_id uuid references bids(id),
  revision int default 1,
  system text,                   -- layher_allround | ringlock | tube_clamp | frame | cuplock
  status text default 'queued'
    check (status in ('queued','draft','checked','issued_for_review','ifc_seal_pending','sealed','superseded')),
  ifc_path text,
  rvt_path text,
  drawings_path text,
  bay_grid jsonb,                -- input to bim-model
  created_at timestamptz default now()
);

create table if not exists load_checks (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid references models(id),
  inputs jsonb not null,
  results jsonb not null,
  passed boolean not null,
  reviewed_by text,
  created_at timestamptz default now()
);

create table if not exists components (
  id uuid primary key default uuid_generate_v4(),
  system text not null,
  sku text not null,
  description text,
  length_m numeric,
  weight_kg numeric,
  rental_rate_month numeric,     -- USD per piece per month
  purchase_price numeric,
  unique (system, sku)
);

create table if not exists rates (
  key text primary key,          -- e.g. labor.erector.hour, freight.zone1.truckload
  value numeric not null,
  unit text,
  notes text,
  updated_at timestamptz default now()
);

create table if not exists approvals (
  id serial primary key,
  kind text not null,            -- money | commitment | engineering | legal | comms
  summary text not null,
  payload jsonb,
  recommended text,
  decision text check (decision in ('approve','edit','reject')),
  decided_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists ops_health (
  id serial primary key,
  run_at timestamptz default now(),
  connector text not null,
  ok boolean not null,
  detail text
);
