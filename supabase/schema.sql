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
  yes_pool numeric default 0,
  no_pool numeric default 0,
  created_at timestamptz default now(),
  resolves_at timestamptz,
  resolved boolean default false,
  outcome boolean,
  groq_resolution_reasoning text
);

create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  market_id bigint references markets(id),
  wallet_address text not null,
  side boolean not null,
  amount_usdc numeric not null,
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
