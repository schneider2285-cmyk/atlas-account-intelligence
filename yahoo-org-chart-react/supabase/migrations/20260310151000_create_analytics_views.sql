-- Analytics views for dashboard queries.

create or replace view public.atlas_connector_health_v as
select
  connector,
  count(*) as run_count,
  sum(signal_count) as signal_count,
  sum(positive_count) as positive_count,
  sum(negative_count) as negative_count,
  max(run_at) as latest_run_at
from public.atlas_connector_runs
group by connector;

create or replace view public.atlas_latest_opportunity_v as
select
  a.id as account_id,
  a.name as account_name,
  a.owner,
  a.stage,
  a.arr_potential,
  o.score,
  o.band,
  o.updated_at,
  o.drivers
from public.atlas_accounts a
left join public.atlas_opportunities o on o.account_id = a.id;

create or replace view public.atlas_score_trend_v as
select
  account_id,
  date_trunc('day', observed_at) as day,
  avg(score)::numeric(5,2) as avg_score,
  max(score) as high_score,
  min(score) as low_score,
  count(*) as points
from public.atlas_score_history
group by account_id, date_trunc('day', observed_at);
