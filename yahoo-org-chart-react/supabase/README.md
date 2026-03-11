# Supabase Setup

## Migrations

Apply migrations from this folder in order:

1. `migrations/20260310143000_create_atlas_schema.sql`
2. `migrations/20260310143100_seed_atlas_data.sql`
3. `migrations/20260310150000_extend_runtime_tables.sql`
4. `migrations/20260310151000_create_analytics_views.sql`

With Supabase CLI:

```bash
supabase db push
```

Or paste each migration into Supabase SQL editor and run sequentially.

## Environment Variables

Create `.env` from `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Notes

- The schema uses snake_case database columns.
- The app maps these columns to camelCase in the frontend repository layer.
- RLS is enabled with open `anon`/`authenticated` policies for development convenience; restrict before production.
- Production hardening policies are provided in `policies/production_rls.sql`.
- Transitional hardening (anon read-only) is provided in `policies/transitional_rls.sql`.
- The frontend now has an email/password auth gate; strict production RLS expects authenticated sessions.
