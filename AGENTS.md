You are building the Atlas Account Intelligence platform.

Stack:
Next.js
Supabase
TypeScript
Tailwind
Vercel

Purpose:
Monitor Yahoo, FICO, and Schneider Electric for hiring signals,
leadership movement, product initiatives, conferences,
and LinkedIn discoveries.

The platform runs 12 scheduled agents.

Agents must only collect and normalize signals.

Signal interpretation must occur in the intelligence engine.

Do not auto-send outreach.
Only recommend actions.

UI must be dark mode only.

Major system layers:

1. Connectors
2. Normalization
3. Signal engine
4. Opportunity scoring
5. Strategy briefing
6. Dashboard interface

LinkedIn must only be accessed through the linkupService adapter.

Never call Linkup directly from UI code.

The dashboard must show:

signals feed
discoveries table
org chart explorer
outreach kanban
agent health console
daily strategy brief

Deployment:
Vercel + Supabase.

Cron endpoints trigger agents.

Do not introduce unnecessary UI complexity.
Focus on signal quality and explainability.
