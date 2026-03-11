-- Multi-tenant + role-based security model for Atlas.
-- Adds org isolation (org_id) and role tiers: admin, manager, rep.

create table if not exists public.atlas_orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.atlas_orgs (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'default-org', 'Default Atlas Org')
on conflict (id) do nothing;

create table if not exists public.atlas_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.atlas_orgs(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'rep')) default 'manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_user_profiles_org_id_idx on public.atlas_user_profiles(org_id);
create index if not exists atlas_user_profiles_role_idx on public.atlas_user_profiles(role);

drop trigger if exists atlas_orgs_set_updated_at on public.atlas_orgs;
create trigger atlas_orgs_set_updated_at
before update on public.atlas_orgs
for each row execute function public.set_atlas_updated_at();

drop trigger if exists atlas_user_profiles_set_updated_at on public.atlas_user_profiles;
create trigger atlas_user_profiles_set_updated_at
before update on public.atlas_user_profiles
for each row execute function public.set_atlas_updated_at();

create or replace function public.atlas_current_org_id()
returns uuid
language sql
stable
as $$
  select org_id from public.atlas_user_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.atlas_has_any_role(roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.atlas_user_profiles
    where user_id = auth.uid()
      and role = any(roles)
  );
$$;

create or replace function public.atlas_current_role()
returns text
language sql
stable
as $$
  select role from public.atlas_user_profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.atlas_provision_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.atlas_user_profiles (user_id, org_id, role)
  values (new.id, '00000000-0000-0000-0000-000000000001', 'manager')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_atlas on auth.users;
create trigger on_auth_user_created_atlas
after insert on auth.users
for each row execute function public.atlas_provision_user_profile();

insert into public.atlas_user_profiles (user_id, org_id, role)
select
  u.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'manager'
from auth.users u
left join public.atlas_user_profiles p on p.user_id = u.id
where p.user_id is null;

do $$
declare
  tbl text;
  org_tables text[] := array[
    'atlas_accounts',
    'atlas_contacts',
    'atlas_org_charts',
    'atlas_opportunities',
    'atlas_signals',
    'atlas_briefs',
    'atlas_activities',
    'atlas_kanban_cards',
    'atlas_agent_runs',
    'atlas_connector_runs',
    'atlas_score_history'
  ];
  constraint_name text;
  index_name text;
begin
  foreach tbl in array org_tables
  loop
    execute format('alter table public.%I add column if not exists org_id uuid', tbl);
    execute format(
      'update public.%I set org_id = %L::uuid where org_id is null',
      tbl,
      '00000000-0000-0000-0000-000000000001'
    );
    execute format('alter table public.%I alter column org_id set default public.atlas_current_org_id()', tbl);
    execute format('alter table public.%I alter column org_id set not null', tbl);

    constraint_name := format('%s_org_id_fkey', tbl);
    if not exists (select 1 from pg_constraint where conname = constraint_name) then
      execute format(
        'alter table public.%I add constraint %I foreign key (org_id) references public.atlas_orgs(id) on delete cascade',
        tbl,
        constraint_name
      );
    end if;

    index_name := format('%s_org_id_idx', tbl);
    execute format('create index if not exists %I on public.%I(org_id)', index_name, tbl);
  end loop;
end $$;

alter table public.atlas_orgs enable row level security;
alter table public.atlas_user_profiles enable row level security;

-- Remove all existing Atlas policies to cleanly recreate with org/role constraints.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename like 'atlas_%'
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Org-level policies
create policy atlas_orgs_select_org
on public.atlas_orgs
for select
to authenticated
using (id = public.atlas_current_org_id());

create policy atlas_orgs_write_admin
on public.atlas_orgs
for all
to authenticated
using (
  id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
)
with check (
  id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
);

-- User profile policies
create policy atlas_user_profiles_select_org
on public.atlas_user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    org_id = public.atlas_current_org_id()
    and public.atlas_has_any_role(array['admin', 'manager'])
  )
);

create policy atlas_user_profiles_write_admin
on public.atlas_user_profiles
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
);

-- Shared select policy for org-scoped Atlas tables
create policy atlas_accounts_select_org
on public.atlas_accounts
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_contacts_select_org
on public.atlas_contacts
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_org_charts_select_org
on public.atlas_org_charts
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_opportunities_select_org
on public.atlas_opportunities
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_signals_select_org
on public.atlas_signals
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_briefs_select_org
on public.atlas_briefs
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_activities_select_org
on public.atlas_activities
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_kanban_cards_select_org
on public.atlas_kanban_cards
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_agent_runs_select_org
on public.atlas_agent_runs
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_connector_runs_select_org
on public.atlas_connector_runs
for select
to authenticated
using (org_id = public.atlas_current_org_id());

create policy atlas_score_history_select_org
on public.atlas_score_history
for select
to authenticated
using (org_id = public.atlas_current_org_id());

-- Admin-only write tier (master data)
create policy atlas_accounts_write_admin
on public.atlas_accounts
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
);

create policy atlas_contacts_write_admin
on public.atlas_contacts
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
);

create policy atlas_org_charts_write_admin
on public.atlas_org_charts
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin'])
);

-- Manager + Admin write tier (system runtime data)
create policy atlas_opportunities_write_manager
on public.atlas_opportunities
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

create policy atlas_signals_write_manager
on public.atlas_signals
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

create policy atlas_briefs_write_manager
on public.atlas_briefs
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

create policy atlas_agent_runs_write_manager
on public.atlas_agent_runs
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

create policy atlas_connector_runs_write_manager
on public.atlas_connector_runs
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

create policy atlas_score_history_write_manager
on public.atlas_score_history
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager'])
);

-- Rep + Manager + Admin write tier (rep workflow actions)
create policy atlas_activities_write_rep
on public.atlas_activities
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager', 'rep'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager', 'rep'])
);

create policy atlas_kanban_cards_write_rep
on public.atlas_kanban_cards
for all
to authenticated
using (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager', 'rep'])
)
with check (
  org_id = public.atlas_current_org_id()
  and public.atlas_has_any_role(array['admin', 'manager', 'rep'])
);
