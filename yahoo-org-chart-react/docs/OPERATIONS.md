# Atlas Operations

Day-2 commands for the live Atlas workspace.

## 1. Local Run

```bash
cd /Users/matthewschneider/Documents/Playground/yahoo-org-chart-react
npm run dev
```

App URL: use the `Local:` URL shown by Vite.

## 2. Quality Gate (before deploy)

```bash
cd /Users/matthewschneider/Documents/Playground/yahoo-org-chart-react
npm run ci
```

## 3. Apply Latest DB Changes

```bash
cd /Users/matthewschneider/Documents/Playground/yahoo-org-chart-react
supabase db push
```

## 4. Verify Target Accounts

```sql
select id, name, owner, stage, arr_potential
from public.atlas_accounts
order by name;
```

Expected names:
- FICO
- Schneider Electric
- Yahoo

## 5. Role Management

Promote a user to admin:

```sql
update public.atlas_user_profiles p
set role = 'admin'
from auth.users u
where u.id = p.user_id
  and lower(u.email) = lower('<email>');
```

Set a user to rep:

```sql
update public.atlas_user_profiles p
set role = 'rep'
from auth.users u
where u.id = p.user_id
  and lower(u.email) = lower('<email>');
```

Check role assignments:

```sql
select u.email, p.role, p.org_id
from public.atlas_user_profiles p
join auth.users u on u.id = p.user_id
order by u.email;
```

## 6. Runtime Verification

1. Sign in as `admin`: verify dashboard loads and kanban move persists.
2. Sign out/incognito: verify anonymous access is blocked.
3. Sign in as `rep`: verify reads work and writes are blocked.

## 7. Release Commands

From repo root:

```bash
cd /Users/matthewschneider/Documents/Playground
git pull --ff-only
git push origin main
git tag -a vX.Y.Z -m "release"
git push origin vX.Y.Z
```

Current production tag: `v1.0.0-atlas-prod`

## 8. Incident Shortcut

- Schema/auth issues: run latest migration + recheck role queries.
- RLS/auth behavior: see deployment runbook:
  [`docs/deployment-runbook.md`](./deployment-runbook.md)
