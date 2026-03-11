# Atlas Deployment Runbook

This runbook is for production-safe deployment of Atlas with Supabase Auth and strict RLS.

## 1. Preconditions

- App build must pass: `npm run ci`
- Supabase project exists and Auth is enabled
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured in the frontend deploy target
- You have a SQL execution path: Supabase CLI (`supabase db push`) or SQL Editor
- At least one admin user account exists in Supabase Auth

## 2. Recommended Release Order

1. Deploy application code to staging.
2. Apply all SQL migrations in staging.
3. Validate staging with authenticated users.
4. Promote code to production.
5. Apply SQL migrations in production.
6. Apply strict production RLS policy in production.
7. Verify authenticated reads/writes and blocked anonymous access.

## 3. Migration Steps

From `yahoo-org-chart-react/`:

```bash
supabase db push
```

If you use SQL Editor, run migrations from `supabase/migrations` in timestamp order.

After migrations, verify key objects exist:

- Core tables: `atlas_accounts`, `atlas_contacts`, `atlas_org_charts`, `atlas_opportunities`, `atlas_signals`, `atlas_briefs`, `atlas_activities`, `atlas_kanban_cards`, `atlas_agent_runs`, `atlas_connector_runs`, `atlas_score_history`
- Multitenancy and identity tables: `atlas_orgs`, `atlas_user_profiles`
- RLS helper functions: `atlas_current_org_id`, `atlas_has_any_role`, `atlas_current_role`

## 4. Auth + RLS Activation

1. Keep transitional policies until authenticated UI is verified:

```bash
psql "$SUPABASE_DB_URL" -f supabase/policies/transitional_rls.sql
```

2. Sign in through the app and confirm data loads.
3. Promote to strict production policy:

```bash
psql "$SUPABASE_DB_URL" -f supabase/policies/production_rls.sql
```

If `psql` is not available, open each policy file and run its SQL in the Supabase SQL Editor.

Expected strict behavior:

- Anonymous users: blocked from reading/writing Atlas tables
- Authenticated `admin` and `manager`: read/write according to policy tiers
- Authenticated `rep`: read-only behavior from UI plus write blocks at DB layer

## 5. Post-Deploy Validation Checklist

- Dashboard renders non-zero data for authenticated users
- Signal refresh works for `admin` and `manager`
- Kanban move persists for `admin` and `manager`
- `rep` can sign in and read data, but cannot persist updates
- Anonymous session cannot read Atlas rows (401/403 expected)
- No placeholder values remain in env configuration

## 6. Rollback Plan

If release health fails:

1. Roll back frontend deployment to previous known-good artifact.
2. Re-apply transitional RLS policy to reduce blast radius while keeping authenticated testing available.
3. If the issue is migration-related, restore from backup/snapshot and re-run migration sequence in staging first.

Notes:

- Avoid dropping production tables as a rollback strategy.
- Prefer policy rollback and app rollback first.
- Treat schema rollback as a planned DB restore operation.

## 7. Operational Notes

- Create user profiles with explicit role assignments in `atlas_user_profiles`.
- Keep at least one `admin` per org to avoid lockout.
- Run `npm run ci` before every release tag.
