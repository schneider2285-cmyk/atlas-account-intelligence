create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  company_url text,
  priority_rank int,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  name text not null,
  parent_name text,
  priority_weight int default 1,
  created_at timestamp default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  full_name text not null,
  title text,
  department_id uuid references departments(id),
  seniority_level text,
  linkedin_url text,
  status text default 'active',
  source_confidence float default 0.5,
  first_seen_at timestamp,
  last_verified_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists job_postings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  external_job_id text unique,
  title text,
  department_id uuid references departments(id),
  location text,
  url text,
  posted_at timestamp,
  detected_at timestamp default now()
);

create table if not exists initiatives (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  name text not null,
  description text,
  urgency_level text,
  strategic_weight int default 1,
  active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  signal_type text not null,
  title text not null,
  summary text,
  source_type text,
  source_url text,
  source_date timestamp,
  significance_score float default 0.5,
  detected_at timestamp default now(),
  created_at timestamp default now()
);

create table if not exists discoveries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  full_name text not null,
  title text,
  department_id uuid references departments(id),
  seniority_level text,
  linkedin_url text,
  tenure_bucket text,
  is_new_hire boolean default false,
  discovery_source text,
  classification text,
  recommendation_reason text,
  intro_path_json jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists outreach_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  contact_id uuid references contacts(id),
  discovery_id uuid references discoveries(id),
  title text not null,
  status text default 'Not Started',
  notes text,
  owner_name text,
  next_step text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  started_at timestamp default now(),
  finished_at timestamp,
  status text,
  summary text,
  output_count int default 0,
  error_message text
);

create table if not exists daily_briefs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id),
  generated_for_date date not null,
  system_health_summary text,
  intelligence_summary jsonb,
  priority_actions jsonb,
  risk_flags jsonb,
  opportunity_score text,
  created_at timestamp default now()
);
