-- Replace legacy demo accounts with target Atlas accounts for the default org.
-- This migration is safe to re-run.

-- Clear default-org data so the dashboard shows only planned accounts.
delete from public.atlas_score_history where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_connector_runs where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_agent_runs where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_kanban_cards where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_signals where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_opportunities where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_contacts where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_org_charts where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_activities where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_briefs where org_id = '00000000-0000-0000-0000-000000000001';
delete from public.atlas_accounts where org_id = '00000000-0000-0000-0000-000000000001';

insert into public.atlas_accounts (
  id, org_id, name, industry, segment, owner, stage, arr_potential, employee_count, website
)
values
  ('acct-yahoo', '00000000-0000-0000-0000-000000000001', 'Yahoo', 'Media & Technology', 'Enterprise', 'Atlas Team', 'Signal Monitoring', 900000, 12000, 'yahoo.com'),
  ('acct-fico', '00000000-0000-0000-0000-000000000001', 'FICO', 'Financial Software', 'Enterprise', 'Atlas Team', 'Intelligence Build', 700000, 4000, 'fico.com'),
  ('acct-schneider-electric', '00000000-0000-0000-0000-000000000001', 'Schneider Electric', 'Industrial Technology', 'Enterprise', 'Atlas Team', 'Executive Mapping', 850000, 150000, 'se.com')
on conflict (id) do update
set
  org_id = excluded.org_id,
  name = excluded.name,
  industry = excluded.industry,
  segment = excluded.segment,
  owner = excluded.owner,
  stage = excluded.stage,
  arr_potential = excluded.arr_potential,
  employee_count = excluded.employee_count,
  website = excluded.website,
  updated_at = now();

insert into public.atlas_contacts (
  id, org_id, account_id, name, title, job_function, influence
)
values
  ('y-101', '00000000-0000-0000-0000-000000000001', 'acct-yahoo', 'Platform Strategy Lead', 'VP Product Strategy', 'Product', 'high'),
  ('y-102', '00000000-0000-0000-0000-000000000001', 'acct-yahoo', 'Revenue Systems Leader', 'Director, Revenue Operations', 'RevOps', 'medium'),
  ('f-201', '00000000-0000-0000-0000-000000000001', 'acct-fico', 'Decisioning Portfolio Lead', 'SVP Decision Platforms', 'Product', 'high'),
  ('f-202', '00000000-0000-0000-0000-000000000001', 'acct-fico', 'Go-to-Market Programs Leader', 'VP GTM Programs', 'GTM', 'medium'),
  ('s-301', '00000000-0000-0000-0000-000000000001', 'acct-schneider-electric', 'Digital Transformation Sponsor', 'EVP Digital Transformation', 'Executive', 'high'),
  ('s-302', '00000000-0000-0000-0000-000000000001', 'acct-schneider-electric', 'Global Partnerships Director', 'Director, Strategic Partnerships', 'Partnerships', 'medium')
on conflict (id) do update
set
  org_id = excluded.org_id,
  account_id = excluded.account_id,
  name = excluded.name,
  title = excluded.title,
  job_function = excluded.job_function,
  influence = excluded.influence;

insert into public.atlas_org_charts (account_id, org_id, chart)
values
  (
    'acct-yahoo',
    '00000000-0000-0000-0000-000000000001',
    '{
      "id":"y-root",
      "name":"Platform Strategy Lead",
      "title":"VP Product Strategy",
      "department":"Product",
      "children":[
        {
          "id":"y-root-1",
          "name":"Revenue Systems Leader",
          "title":"Director, Revenue Operations",
          "department":"RevOps"
        },
        {
          "id":"y-root-2",
          "name":"Audience Growth Leader",
          "title":"Head of Audience Growth",
          "department":"Growth"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-fico',
    '00000000-0000-0000-0000-000000000001',
    '{
      "id":"f-root",
      "name":"Decisioning Portfolio Lead",
      "title":"SVP Decision Platforms",
      "department":"Product",
      "children":[
        {
          "id":"f-root-1",
          "name":"Go-to-Market Programs Leader",
          "title":"VP GTM Programs",
          "department":"GTM"
        },
        {
          "id":"f-root-2",
          "name":"Risk Solutions Architect",
          "title":"Director, Risk Solutions",
          "department":"Solutions"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-schneider-electric',
    '00000000-0000-0000-0000-000000000001',
    '{
      "id":"s-root",
      "name":"Digital Transformation Sponsor",
      "title":"EVP Digital Transformation",
      "department":"Executive",
      "children":[
        {
          "id":"s-root-1",
          "name":"Global Partnerships Director",
          "title":"Director, Strategic Partnerships",
          "department":"Partnerships"
        },
        {
          "id":"s-root-2",
          "name":"Energy Automation Lead",
          "title":"VP Energy Automation",
          "department":"Automation"
        }
      ]
    }'::jsonb
  )
on conflict (account_id) do update
set
  org_id = excluded.org_id,
  chart = excluded.chart,
  updated_at = now();
