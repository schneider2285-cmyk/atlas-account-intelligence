# ATLAS Build Instructions

Build exactly to the architecture in this repo.

## Non-negotiables
- Dark mode only
- No auto-sent outreach
- Linkup behind a single service boundary
- Agents emit normalized facts, not UI blobs
- Recommendations must be explainable from stored signals
- Bryan pages must remain scoped to Yahoo only

## Priority order
1. schema and types
2. connectors
3. agent framework
4. signal scoring
5. briefing engine
6. dashboard read surfaces
7. outreach board persistence

## Done means
- app builds
- routes work
- seed script works
- cron endpoint runs all agents without crashing
- dashboard reads real data from Supabase
