-- Transitional hardening: keep anonymous READ access so current app keeps loading,
-- but block anonymous WRITES. Authenticated users keep read/write.

-- Helper pattern used below per table:
-- 1) drop open policies
-- 2) create anon/authenticated SELECT policy
-- 3) create authenticated-only WRITE policy

-- atlas_accounts

drop policy if exists atlas_accounts_select_all on public.atlas_accounts;
drop policy if exists atlas_accounts_write_all on public.atlas_accounts;
create policy atlas_accounts_select_public
on public.atlas_accounts
for select
to anon, authenticated
using (true);
create policy atlas_accounts_write_authenticated
on public.atlas_accounts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_contacts

drop policy if exists atlas_contacts_select_all on public.atlas_contacts;
drop policy if exists atlas_contacts_write_all on public.atlas_contacts;
create policy atlas_contacts_select_public
on public.atlas_contacts
for select
to anon, authenticated
using (true);
create policy atlas_contacts_write_authenticated
on public.atlas_contacts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_org_charts

drop policy if exists atlas_org_charts_select_all on public.atlas_org_charts;
drop policy if exists atlas_org_charts_write_all on public.atlas_org_charts;
create policy atlas_org_charts_select_public
on public.atlas_org_charts
for select
to anon, authenticated
using (true);
create policy atlas_org_charts_write_authenticated
on public.atlas_org_charts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_opportunities

drop policy if exists atlas_opportunities_select_all on public.atlas_opportunities;
drop policy if exists atlas_opportunities_write_all on public.atlas_opportunities;
create policy atlas_opportunities_select_public
on public.atlas_opportunities
for select
to anon, authenticated
using (true);
create policy atlas_opportunities_write_authenticated
on public.atlas_opportunities
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_signals

drop policy if exists atlas_signals_select_all on public.atlas_signals;
drop policy if exists atlas_signals_write_all on public.atlas_signals;
create policy atlas_signals_select_public
on public.atlas_signals
for select
to anon, authenticated
using (true);
create policy atlas_signals_write_authenticated
on public.atlas_signals
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_briefs

drop policy if exists atlas_briefs_select_all on public.atlas_briefs;
drop policy if exists atlas_briefs_write_all on public.atlas_briefs;
create policy atlas_briefs_select_public
on public.atlas_briefs
for select
to anon, authenticated
using (true);
create policy atlas_briefs_write_authenticated
on public.atlas_briefs
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_activities

drop policy if exists atlas_activities_select_all on public.atlas_activities;
drop policy if exists atlas_activities_write_all on public.atlas_activities;
create policy atlas_activities_select_public
on public.atlas_activities
for select
to anon, authenticated
using (true);
create policy atlas_activities_write_authenticated
on public.atlas_activities
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_kanban_cards

drop policy if exists atlas_kanban_cards_select_all on public.atlas_kanban_cards;
drop policy if exists atlas_kanban_cards_write_all on public.atlas_kanban_cards;
create policy atlas_kanban_cards_select_public
on public.atlas_kanban_cards
for select
to anon, authenticated
using (true);
create policy atlas_kanban_cards_write_authenticated
on public.atlas_kanban_cards
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_agent_runs

drop policy if exists atlas_agent_runs_select_all on public.atlas_agent_runs;
drop policy if exists atlas_agent_runs_write_all on public.atlas_agent_runs;
create policy atlas_agent_runs_select_public
on public.atlas_agent_runs
for select
to anon, authenticated
using (true);
create policy atlas_agent_runs_write_authenticated
on public.atlas_agent_runs
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_connector_runs

drop policy if exists atlas_connector_runs_select_all on public.atlas_connector_runs;
drop policy if exists atlas_connector_runs_write_all on public.atlas_connector_runs;
create policy atlas_connector_runs_select_public
on public.atlas_connector_runs
for select
to anon, authenticated
using (true);
create policy atlas_connector_runs_write_authenticated
on public.atlas_connector_runs
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- atlas_score_history

drop policy if exists atlas_score_history_select_all on public.atlas_score_history;
drop policy if exists atlas_score_history_write_all on public.atlas_score_history;
create policy atlas_score_history_select_public
on public.atlas_score_history
for select
to anon, authenticated
using (true);
create policy atlas_score_history_write_authenticated
on public.atlas_score_history
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
