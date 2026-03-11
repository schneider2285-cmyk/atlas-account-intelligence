-- Atlas Account Intelligence schema
-- Apply with Supabase CLI or SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_atlas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.atlas_accounts (
  id text primary key,
  name text not null,
  industry text not null,
  segment text not null,
  owner text not null,
  stage text not null,
  arr_potential integer not null check (arr_potential >= 0),
  employee_count integer,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_contacts (
  id text primary key,
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  name text not null,
  title text not null,
  job_function text not null,
  influence text not null check (influence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_org_charts (
  account_id text primary key references public.atlas_accounts(id) on delete cascade,
  chart jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_opportunities (
  account_id text primary key references public.atlas_accounts(id) on delete cascade,
  score integer not null check (score between 1 and 100),
  band text not null check (band in ('Tier 1', 'Tier 2', 'Tier 3', 'Tier 4')),
  drivers jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text,
  account_id text not null references public.atlas_accounts(id) on delete cascade,
  connector text not null,
  category text not null,
  label text not null,
  detail text,
  direction text not null check (direction in ('positive', 'negative')),
  weight integer not null check (weight between 1 and 10),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null,
  freshness_hours integer,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_key text,
  generated_at timestamptz not null,
  headline text not null,
  markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.atlas_activities (
  id uuid primary key default gen_random_uuid(),
  activity_key text,
  account_id text references public.atlas_accounts(id) on delete set null,
  actor text not null,
  message text not null,
  event_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists atlas_contacts_account_id_idx on public.atlas_contacts(account_id);
create index if not exists atlas_signals_account_id_idx on public.atlas_signals(account_id);
create index if not exists atlas_signals_observed_at_idx on public.atlas_signals(observed_at desc);
create index if not exists atlas_signals_category_idx on public.atlas_signals(category);
create index if not exists atlas_opportunities_score_idx on public.atlas_opportunities(score desc);
create index if not exists atlas_activities_event_at_idx on public.atlas_activities(event_at desc);
create index if not exists atlas_briefs_generated_at_idx on public.atlas_briefs(generated_at desc);

drop trigger if exists atlas_accounts_set_updated_at on public.atlas_accounts;
create trigger atlas_accounts_set_updated_at
before update on public.atlas_accounts
for each row execute function public.set_atlas_updated_at();

drop trigger if exists atlas_org_charts_set_updated_at on public.atlas_org_charts;
create trigger atlas_org_charts_set_updated_at
before update on public.atlas_org_charts
for each row execute function public.set_atlas_updated_at();

drop trigger if exists atlas_opportunities_set_updated_at on public.atlas_opportunities;
create trigger atlas_opportunities_set_updated_at
before update on public.atlas_opportunities
for each row execute function public.set_atlas_updated_at();

alter table public.atlas_accounts enable row level security;
alter table public.atlas_contacts enable row level security;
alter table public.atlas_org_charts enable row level security;
alter table public.atlas_opportunities enable row level security;
alter table public.atlas_signals enable row level security;
alter table public.atlas_briefs enable row level security;
alter table public.atlas_activities enable row level security;

drop policy if exists atlas_accounts_select_all on public.atlas_accounts;
create policy atlas_accounts_select_all
on public.atlas_accounts
for select
to anon, authenticated
using (true);

drop policy if exists atlas_accounts_write_all on public.atlas_accounts;
create policy atlas_accounts_write_all
on public.atlas_accounts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_contacts_select_all on public.atlas_contacts;
create policy atlas_contacts_select_all
on public.atlas_contacts
for select
to anon, authenticated
using (true);

drop policy if exists atlas_contacts_write_all on public.atlas_contacts;
create policy atlas_contacts_write_all
on public.atlas_contacts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_org_charts_select_all on public.atlas_org_charts;
create policy atlas_org_charts_select_all
on public.atlas_org_charts
for select
to anon, authenticated
using (true);

drop policy if exists atlas_org_charts_write_all on public.atlas_org_charts;
create policy atlas_org_charts_write_all
on public.atlas_org_charts
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_opportunities_select_all on public.atlas_opportunities;
create policy atlas_opportunities_select_all
on public.atlas_opportunities
for select
to anon, authenticated
using (true);

drop policy if exists atlas_opportunities_write_all on public.atlas_opportunities;
create policy atlas_opportunities_write_all
on public.atlas_opportunities
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_signals_select_all on public.atlas_signals;
create policy atlas_signals_select_all
on public.atlas_signals
for select
to anon, authenticated
using (true);

drop policy if exists atlas_signals_write_all on public.atlas_signals;
create policy atlas_signals_write_all
on public.atlas_signals
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_briefs_select_all on public.atlas_briefs;
create policy atlas_briefs_select_all
on public.atlas_briefs
for select
to anon, authenticated
using (true);

drop policy if exists atlas_briefs_write_all on public.atlas_briefs;
create policy atlas_briefs_write_all
on public.atlas_briefs
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists atlas_activities_select_all on public.atlas_activities;
create policy atlas_activities_select_all
on public.atlas_activities
for select
to anon, authenticated
using (true);

drop policy if exists atlas_activities_write_all on public.atlas_activities;
create policy atlas_activities_write_all
on public.atlas_activities
for all
to anon, authenticated
using (true)
with check (true);
