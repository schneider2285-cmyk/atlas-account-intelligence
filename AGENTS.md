# Atlas Architecture Guide

## System Layers

- `domain`: business logic for signals, opportunity scoring, agents, and strategy briefs.
- `infrastructure`: external integrations (connector services) and persistence (Supabase repository layer).
- `application`: orchestration/service workflows that build the daily workspace.
- `ui`: React presentation layer for dashboard, kanban, org chart explorer, and brief views.

## Agent Architecture

12 agents run per account in `src/domain/agents/agentCatalog.js`:

1. ICP Fit Agent
2. Trigger Event Agent
3. Buying Committee Agent
4. Champion Agent
5. Risk Agent
6. Messaging Agent
7. Sequencing Agent
8. Pricing Strategy Agent
9. Competitive Intel Agent
10. Relationship Mapper Agent
11. Next Best Action Agent
12. Strategy Brief Agent

## Signal + Scoring Flow

1. Connector services collect account-level source data.
2. Signal engine normalizes connector outputs into weighted signals.
3. Opportunity scoring model computes score bands and play recommendations.
4. Agent layer produces per-account insights and actions.
5. Daily strategy brief composes top actions, themes, and watchlist.

## Repository Layer

`AtlasRepository` uses Supabase when env vars are configured:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Otherwise it falls back to an in-memory seeded implementation with the same repository contract.

Supabase schema + seed migrations live in `supabase/migrations/` and create:

- `atlas_accounts`
- `atlas_contacts`
- `atlas_org_charts`
- `atlas_opportunities`
- `atlas_signals`
- `atlas_briefs`
- `atlas_activities`
- `atlas_kanban_cards`
- `atlas_agent_runs`
- `atlas_connector_runs`
- `atlas_score_history`

Analytics views:

- `atlas_connector_health_v`
- `atlas_latest_opportunity_v`
- `atlas_score_trend_v`

## UI Modules

- `Dashboard`: KPI cards, opportunity scoring table, signal panel, agent grid, activity stream.
- `Outreach Kanban`: stage-based execution board fed by next-best-action outputs.
- `Org Chart Explorer`: account-level reporting structure explorer with search and expand/collapse.
- `Daily Strategy Brief`: generated markdown plus structured strategic actions.
- `Connector Health + Trend`: dashboard modules for connector quality and score trajectory.
- `Agent Workbench`: full 12-agent inspection for a selected account.
