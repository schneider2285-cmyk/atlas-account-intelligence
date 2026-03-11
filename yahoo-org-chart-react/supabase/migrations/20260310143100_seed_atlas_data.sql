-- Seed target Atlas accounts (Yahoo, FICO, Schneider Electric).

insert into public.atlas_accounts (
  id, name, industry, segment, owner, stage, arr_potential, employee_count, website
)
values
  ('acct-yahoo', 'Yahoo', 'Media & Technology', 'Enterprise', 'Atlas Team', 'Signal Monitoring', 900000, 12000, 'yahoo.com'),
  ('acct-fico', 'FICO', 'Financial Software', 'Enterprise', 'Atlas Team', 'Intelligence Build', 700000, 4000, 'fico.com'),
  ('acct-schneider-electric', 'Schneider Electric', 'Industrial Technology', 'Enterprise', 'Atlas Team', 'Executive Mapping', 850000, 150000, 'se.com')
on conflict (id) do update
set
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
  id, account_id, name, title, job_function, influence
)
values
  ('y-101', 'acct-yahoo', 'Platform Strategy Lead', 'VP Product Strategy', 'Product', 'high'),
  ('y-102', 'acct-yahoo', 'Revenue Systems Leader', 'Director, Revenue Operations', 'RevOps', 'medium'),
  ('f-201', 'acct-fico', 'Decisioning Portfolio Lead', 'SVP Decision Platforms', 'Product', 'high'),
  ('f-202', 'acct-fico', 'Go-to-Market Programs Leader', 'VP GTM Programs', 'GTM', 'medium'),
  ('s-301', 'acct-schneider-electric', 'Digital Transformation Sponsor', 'EVP Digital Transformation', 'Executive', 'high'),
  ('s-302', 'acct-schneider-electric', 'Global Partnerships Director', 'Director, Strategic Partnerships', 'Partnerships', 'medium')
on conflict (id) do update
set
  account_id = excluded.account_id,
  name = excluded.name,
  title = excluded.title,
  job_function = excluded.job_function,
  influence = excluded.influence;

insert into public.atlas_org_charts (account_id, chart)
values
  (
    'acct-yahoo',
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
  chart = excluded.chart,
  updated_at = now();
