# ATLAS Account Intelligence

Production-grade account intelligence platform for Yahoo, FICO, and Schneider Electric.

## Stack
- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Vercel cron

## What this repo includes
- Dashboard shell
- Bryan Yahoo-only partner view
- Connector boundaries
- 12-agent execution framework
- Signal scoring layer
- Daily briefing generator
- SQL schema and seed script

## Environment variables
Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LINKUP_TOKEN=
NEWS_API_KEY=
```

## Commands
```bash
npm install
npm run seed
npm run dev
npm run run:agents
```

## Deploy
1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Create Supabase database and run SQL in `database/migrations/001_initial.sql`
5. Enable cron routes in Vercel
