create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  headline text not null,
  description text,
  source_name text,
  country text,
  published_at timestamptz,
  groq_suitable boolean,
  groq_question text,
  groq_category text,
  groq_duration_days integer,
  groq_reasoning text,
  market_created boolean default false,
  scanned_at timestamptz default now()
);

create table if not exists markets (
  id bigint primary key,
  question text not null,
  category text not null,
  country text,
  news_item_id uuid references news_items(id),
  resolution_criteria text,
  groq_yes_probability numeric check (groq_yes_probability >= 1 and groq_yes_probability <= 99),
  initial_probability_yes integer default 50,
  yes_pool numeric default 0,
  no_pool numeric default 0,
  eurc_yes_pool numeric default 0,
  eurc_no_pool numeric default 0,
  usyc_invested boolean default false,
  yield_earned numeric default 0,
  agent_seeded boolean default false,
  created_at timestamptz default now(),
  resolves_at timestamptz,
  resolved boolean default false,
  outcome boolean,
  groq_resolution_reasoning text,
  created_by text default 'GENLAYER',
  resolution_mode text default 'GENLAYER',
  resolution_source_url text,
  genlayer_creator_tx text,
  genlayer_resolver_tx text,
  genlayer_status text default 'NOT_REQUESTED',
  genlayer_creation_reasoning text,
  genlayer_resolution_reasoning text,
  genlayer_resolution_evidence text,
  genlayer_resolution_source_used text,
  duration_days integer,
  resolves_at_reason text
);

create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  market_id bigint references markets(id),
  wallet_address text not null,
  side boolean not null,
  amount_usdc numeric not null,
  currency text default 'USDC',
  tx_hash text unique,
  created_at timestamptz default now()
);

create table if not exists pending_resolution (
  id uuid primary key default gen_random_uuid(),
  market_id bigint references markets(id),
  resolved boolean default false,
  admin_note text,
  created_at timestamptz default now(),
  unique (market_id)
);

create index if not exists markets_status_created_idx on markets (resolved, created_at desc);
create index if not exists markets_category_status_created_idx on markets (category, resolved, created_at desc);
create index if not exists markets_country_status_created_idx on markets (country, resolved, created_at desc);
create index if not exists bets_market_created_idx on bets (market_id, created_at desc);
create index if not exists news_items_scanned_idx on news_items (scanned_at desc);
create index if not exists news_items_country_scanned_idx on news_items (country, scanned_at desc);
create index if not exists news_items_category_scanned_idx on news_items (groq_category, scanned_at desc);
create index if not exists pending_resolution_status_created_idx on pending_resolution (resolved, created_at desc);

alter publication supabase_realtime add table markets;
alter publication supabase_realtime add table bets;
alter publication supabase_realtime add table news_items;

alter table bets add column if not exists currency text default 'USDC';
alter table markets add column if not exists eurc_yes_pool numeric default 0;
alter table markets add column if not exists eurc_no_pool numeric default 0;
alter table markets add column if not exists usyc_invested boolean default false;
alter table markets add column if not exists yield_earned numeric default 0;
alter table markets add column if not exists initial_probability_yes integer default 50;
alter table markets add column if not exists agent_seeded boolean default false;
alter table markets add column if not exists created_by text default 'GENLAYER';
alter table markets add column if not exists resolution_mode text default 'GENLAYER';
alter table markets add column if not exists resolution_source_url text;
alter table markets add column if not exists genlayer_creator_tx text;
alter table markets add column if not exists genlayer_resolver_tx text;
alter table markets add column if not exists genlayer_status text default 'NOT_REQUESTED';
alter table markets add column if not exists genlayer_creation_reasoning text;
alter table markets add column if not exists genlayer_resolution_reasoning text;
alter table markets add column if not exists genlayer_resolution_evidence text;
alter table markets add column if not exists genlayer_resolution_source_used text;
alter table markets add column if not exists duration_days integer;
alter table markets add column if not exists resolves_at_reason text;
