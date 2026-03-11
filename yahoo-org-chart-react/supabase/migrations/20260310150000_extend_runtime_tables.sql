-- Runtime tables for kanban execution, agent/connector runs, and score trending.

create table if not exists public.atlas_kanban_cards (
  id uuid primary key default gen_random_uuid(),
  card_key text not null unique,
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  account_name text not null,
  owner text not null,
  stage text not null,
  score integer not null check (score between 1 and 100),
  task text not null,
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_agent_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text,
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  priority text not null,
  summary text not null,
  actions jsonb,
  tags jsonb,
  run_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_connector_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text,
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  connector text not null,
  signal_count integer not null check (signal_count >= 0),
  positive_count integer not null check (positive_count >= 0),
  negative_count integer not null check (negative_count >= 0),
  run_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_score_history (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  score integer not null check (score between 1 and 100),
  band text not null check (band in ('Tier 1', 'Tier 2', 'Tier 3', 'Tier 4')),
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists atlas_kanban_cards_account_id_idx on public.atlas_kanban_cards(account_id);
create index if not exists atlas_kanban_cards_stage_idx on public.atlas_kanban_cards(stage);
create index if not exists atlas_kanban_cards_position_idx on public.atlas_kanban_cards(position);
create index if not exists atlas_agent_runs_account_id_idx on public.atlas_agent_runs(account_id);
create index if not exists atlas_agent_runs_run_at_idx on public.atlas_agent_runs(run_at desc);
create index if not exists atlas_agent_runs_priority_idx on public.atlas_agent_runs(priority);
create index if not exists atlas_connector_runs_account_id_idx on public.atlas_connector_runs(account_id);
create index if not exists atlas_connector_runs_connector_idx on public.atlas_connector_runs(connector);
create index if not exists atlas_connector_runs_run_at_idx on public.atlas_connector_runs(run_at desc);
create index if not exists atlas_score_history_account_id_idx on public.atlas_score_history(account_id);
create index if not exists atlas_score_history_observed_at_idx on public.atlas_score_history(observed_at desc);

drop trigger if exists atlas_kanban_cards_set_updated_at on public.atlas_kanban_cards;
create trigger atlas_kanban_cards_set_updated_at
before update on public.atlas_kanban_cards
for each row execute function public.set_atlas_updated_at();

alter table public.atlas_kanban_cards enable row level security;
alter table public.atlas_agent_runs enable row level security;
alter table public.atlas_connector_runs enable row level security;
alter table public.atlas_score_history enable row level security;

drop policy if exists atlas_kanban_cards_select_all on public.atlas_kanban_cards;
create policy atlas_kanban_cards_select_all
on public.atlas_kanban_cards
for select
to anon, authenticated
using (true);

drop policy if exists atlas_kanban_cards_write_all on public.atlas_kanban_cards;
create policy atlas_kanban_cards_write_all
on public.atlas_kanban_cards
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_agent_runs_select_all on public.atlas_agent_runs;
create policy atlas_agent_runs_select_all
on public.atlas_agent_runs
for select
to anon, authenticated
using (true);

drop policy if exists atlas_agent_runs_write_all on public.atlas_agent_runs;
create policy atlas_agent_runs_write_all
on public.atlas_agent_runs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_connector_runs_select_all on public.atlas_connector_runs;
create policy atlas_connector_runs_select_all
on public.atlas_connector_runs
for select
to anon, authenticated
using (true);

drop policy if exists atlas_connector_runs_write_all on public.atlas_connector_runs;
create policy atlas_connector_runs_write_all
on public.atlas_connector_runs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_score_history_select_all on public.atlas_score_history;
create policy atlas_score_history_select_all
on public.atlas_score_history
for select
to anon, authenticated
using (true);

drop policy if exists atlas_score_history_write_all on public.atlas_score_history;
create policy atlas_score_history_write_all
on public.atlas_score_history
for all
to anon, authenticated
using (true)
with check (true);
