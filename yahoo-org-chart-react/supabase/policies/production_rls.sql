-- Strict production RLS for org-isolated Atlas data with role tiers.
-- Prerequisite: run migration 20260311103000_multitenant_org_role_rls.sql first.

alter table public.atlas_orgs enable row level security;
alter table public.atlas_user_profiles enable row level security;
alter table public.atlas_accounts enable row level security;
alter table public.atlas_contacts enable row level security;
alter table public.atlas_org_charts enable row level security;
alter table public.atlas_opportunities enable row level security;
alter table public.atlas_signals enable row level security;
alter table public.atlas_briefs enable row level security;
alter table public.atlas_activities enable row level security;
alter table public.atlas_kanban_cards enable row level security;
alter table public.atlas_agent_runs enable row level security;
alter table public.atlas_connector_runs enable row level security;
alter table public.atlas_score_history enable row level security;

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

create policy atlas_accounts_select_org on public.atlas_accounts for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_contacts_select_org on public.atlas_contacts for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_org_charts_select_org on public.atlas_org_charts for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_opportunities_select_org on public.atlas_opportunities for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_signals_select_org on public.atlas_signals for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_briefs_select_org on public.atlas_briefs for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_activities_select_org on public.atlas_activities for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_kanban_cards_select_org on public.atlas_kanban_cards for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_agent_runs_select_org on public.atlas_agent_runs for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_connector_runs_select_org on public.atlas_connector_runs for select to authenticated using (org_id = public.atlas_current_org_id());
create policy atlas_score_history_select_org on public.atlas_score_history for select to authenticated using (org_id = public.atlas_current_org_id());

create policy atlas_accounts_write_admin
on public.atlas_accounts
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']));

create policy atlas_contacts_write_admin
on public.atlas_contacts
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']));

create policy atlas_org_charts_write_admin
on public.atlas_org_charts
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin']));

create policy atlas_opportunities_write_manager
on public.atlas_opportunities
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_signals_write_manager
on public.atlas_signals
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_briefs_write_manager
on public.atlas_briefs
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_agent_runs_write_manager
on public.atlas_agent_runs
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_connector_runs_write_manager
on public.atlas_connector_runs
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_score_history_write_manager
on public.atlas_score_history
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager']));

create policy atlas_activities_write_rep
on public.atlas_activities
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager', 'rep']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager', 'rep']));

create policy atlas_kanban_cards_write_rep
on public.atlas_kanban_cards
for all
to authenticated
using (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager', 'rep']))
with check (org_id = public.atlas_current_org_id() and public.atlas_has_any_role(array['admin', 'manager', 'rep']));
