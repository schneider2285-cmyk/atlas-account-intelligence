-- Seed master Atlas demo data (accounts, contacts, org charts).

insert into public.atlas_accounts (
  id, name, industry, segment, owner, stage, arr_potential, employee_count, website
)
values
  ('acct-atlas-01', 'Northstar Financial', 'FinTech', 'Enterprise', 'A. Patel', 'Discovery', 420000, 1800, 'northstar.example.com'),
  ('acct-atlas-02', 'Helio Health Systems', 'Healthcare', 'Mid-Market', 'J. Rivera', 'Technical Validation', 285000, 920, 'heliohealth.example.com'),
  ('acct-atlas-03', 'VectorGrid Manufacturing', 'Industrial', 'Enterprise', 'M. Chen', 'Proposal', 510000, 2600, 'vectorgrid.example.com'),
  ('acct-atlas-04', 'Nimbus Commerce', 'Retail Tech', 'Growth', 'K. Thomas', 'Evaluation', 195000, 540, 'nimbuscommerce.example.com'),
  ('acct-atlas-05', 'Crescent Cyber Defense', 'Cybersecurity', 'Enterprise', 'S. Lewis', 'Negotiation', 640000, 1400, 'crescentcyber.example.com')
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
  ('c-101', 'acct-atlas-01', 'Mina Ochoa', 'VP Revenue Operations', 'RevOps', 'high'),
  ('c-102', 'acct-atlas-01', 'James Lu', 'Director, Sales Enablement', 'Enablement', 'medium'),
  ('c-201', 'acct-atlas-02', 'Tariq Bryant', 'Chief Information Officer', 'IT', 'high'),
  ('c-202', 'acct-atlas-02', 'Elena Frost', 'VP Clinical Systems', 'Clinical Ops', 'medium'),
  ('c-301', 'acct-atlas-03', 'Ravi Anand', 'SVP Manufacturing Operations', 'Operations', 'high'),
  ('c-302', 'acct-atlas-03', 'Nadia Hart', 'Director, IT Security', 'Security', 'medium'),
  ('c-401', 'acct-atlas-04', 'Luca Duran', 'Head of GTM Systems', 'GTM Systems', 'high'),
  ('c-402', 'acct-atlas-04', 'Bria Kim', 'Senior Revenue Analyst', 'Finance', 'low'),
  ('c-501', 'acct-atlas-05', 'Margo Flynn', 'Chief Revenue Officer', 'Executive', 'high'),
  ('c-502', 'acct-atlas-05', 'Devon Ng', 'VP Security Programs', 'Security', 'high')
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
    'acct-atlas-01',
    '{
      "id":"root-01",
      "name":"Mina Ochoa",
      "title":"VP Revenue Operations",
      "department":"RevOps",
      "children":[
        {
          "id":"root-01-1",
          "name":"James Lu",
          "title":"Director, Sales Enablement",
          "department":"Enablement"
        },
        {
          "id":"root-01-2",
          "name":"Helen Carr",
          "title":"Director, Revenue Analytics",
          "department":"RevOps"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-atlas-02',
    '{
      "id":"root-02",
      "name":"Tariq Bryant",
      "title":"Chief Information Officer",
      "department":"IT",
      "children":[
        {
          "id":"root-02-1",
          "name":"Elena Frost",
          "title":"VP Clinical Systems",
          "department":"Clinical Ops"
        },
        {
          "id":"root-02-2",
          "name":"Nolan Vega",
          "title":"Director, Infrastructure",
          "department":"IT"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-atlas-03',
    '{
      "id":"root-03",
      "name":"Ravi Anand",
      "title":"SVP Manufacturing Operations",
      "department":"Operations",
      "children":[
        {
          "id":"root-03-1",
          "name":"Nadia Hart",
          "title":"Director, IT Security",
          "department":"Security"
        },
        {
          "id":"root-03-2",
          "name":"Iris Cole",
          "title":"Director, Plant Systems",
          "department":"Operations"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-atlas-04',
    '{
      "id":"root-04",
      "name":"Luca Duran",
      "title":"Head of GTM Systems",
      "department":"GTM Systems",
      "children":[
        {
          "id":"root-04-1",
          "name":"Bria Kim",
          "title":"Senior Revenue Analyst",
          "department":"Finance"
        }
      ]
    }'::jsonb
  ),
  (
    'acct-atlas-05',
    '{
      "id":"root-05",
      "name":"Margo Flynn",
      "title":"Chief Revenue Officer",
      "department":"Executive",
      "children":[
        {
          "id":"root-05-1",
          "name":"Devon Ng",
          "title":"VP Security Programs",
          "department":"Security"
        },
        {
          "id":"root-05-2",
          "name":"Casey North",
          "title":"Director, Revenue Technology",
          "department":"Revenue"
        }
      ]
    }'::jsonb
  )
on conflict (account_id) do update
set
  chart = excluded.chart,
  updated_at = now();
