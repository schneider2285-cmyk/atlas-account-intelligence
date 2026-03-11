# Atlas Account Intelligence Platform (React + Vite)

This repository now implements a full Atlas Account Intelligence application with:

- 12-account intelligence agents
- signal engine
- opportunity scoring
- daily strategy brief generator
- Supabase repository layer (with in-memory fallback)
- connector services
- dashboard UI
- outreach kanban
- org chart explorer

## Architecture

The app follows a layered architecture:

- `src/domain/`
  - `agents/` 12 agent definitions and runner
  - `signals/` signal normalization and momentum computation
  - `scoring/` weighted opportunity score model
  - `briefs/` daily strategy brief generation
  - `kanban/` outreach stage model and transitions
- `src/infrastructure/`
  - `connectors/` CRM, email, usage, news, hiring, and intent connectors
  - `data/supabase/` repository and client adapter
- `src/application/`
  - orchestration service that runs connectors, scoring, agents, persistence, and brief generation
- `src/ui/`
  - dashboard, kanban, strategy brief, and org explorer components
  - connector health, trend visualization, and full agent workbench modules

## Supabase Configuration

Set the following env vars to enable Supabase persistence:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without these values, the app runs entirely in in-memory mode with seeded fixture data.

## Auth Mode (for Strict RLS)

The app now supports Supabase email/password auth directly in UI:

- Sign In with existing Supabase Auth user
- Create Account from login gate (if project allows signup)

When strict `production_rls.sql` is active, users must authenticate before Atlas data loads.

## Supabase Migrations

Migrations are in [`supabase/migrations`](./supabase/migrations):

- `20260310143000_create_atlas_schema.sql`
- `20260310143100_seed_atlas_data.sql`
- `20260310150000_extend_runtime_tables.sql`
- `20260310151000_create_analytics_views.sql`
- `20260311103000_multitenant_org_role_rls.sql`

Apply with Supabase CLI:

```bash
supabase db push
```

Or run both SQL files in the Supabase SQL editor in order.

Note: the default RLS policies in the migration are intentionally open for `anon` and `authenticated` to simplify local/dev usage. Tighten these for production.
For production hardening, apply [`supabase/policies/production_rls.sql`](./supabase/policies/production_rls.sql) after authentication is enabled.
For a safer intermediate step, apply [`supabase/policies/transitional_rls.sql`](./supabase/policies/transitional_rls.sql) to keep anonymous reads while blocking anonymous writes.

Role tiers are enforced via `atlas_user_profiles`:
- `admin`: full org-scoped access
- `manager`: org-scoped runtime writes (signals, opportunities, briefs, run history)
- `rep`: org-scoped workflow writes (activities, kanban)

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
