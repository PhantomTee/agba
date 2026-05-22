alter table bets add column if not exists currency text default 'USDC';

alter table markets add column if not exists eurc_yes_pool numeric default 0;
alter table markets add column if not exists eurc_no_pool numeric default 0;
alter table markets add column if not exists usyc_invested boolean default false;
alter table markets add column if not exists yield_earned numeric default 0;
alter table markets add column if not exists initial_probability_yes integer default 50;
alter table markets add column if not exists agent_seeded boolean default false;
