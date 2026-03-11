import { seedAccounts, seedContacts, seedOrgCharts } from "../../../fixtures/accounts";
import { SupabaseClient } from "./supabaseClient";

function mapAccountFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    segment: row.segment,
    owner: row.owner,
    stage: row.stage,
    arrPotential: row.arr_potential ?? row.arrPotential,
    employeeCount: row.employee_count ?? row.employeeCount,
    website: row.website
  };
}

function mapContactFromDb(row) {
  return {
    id: row.id,
    accountId: row.account_id ?? row.accountId,
    name: row.name,
    title: row.title,
    function: row.job_function ?? row.function,
    influence: row.influence
  };
}

function mapOrgChartFromDb(row) {
  return {
    accountId: row.account_id ?? row.accountId,
    chart: row.chart
  };
}

function mapSignalToDb(row) {
  return {
    signal_key: row.id,
    account_id: row.accountId,
    connector: row.connector,
    category: row.category,
    label: row.label,
    detail: row.detail,
    direction: row.direction,
    weight: row.weight,
    confidence: row.confidence,
    observed_at: row.observedAt,
    freshness_hours: row.freshnessHours
  };
}

function mapOpportunityToDb(row) {
  return {
    account_id: row.accountId,
    score: row.score,
    band: row.band,
    updated_at: row.updatedAt,
    drivers: row.drivers || null
  };
}

function mapBriefToDb(row) {
  return {
    brief_key: row.id,
    generated_at: row.generatedAt,
    headline: row.headline,
    markdown: row.markdown
  };
}

function mapActivityToDb(row) {
  return {
    activity_key: row.id,
    account_id: row.accountId,
    actor: row.actor,
    message: row.message,
    event_at: row.timestamp
  };
}

function mapKanbanToDb(row) {
  return {
    card_key: row.id,
    account_id: row.accountId,
    account_name: row.accountName,
    owner: row.owner,
    stage: row.stage,
    score: row.score,
    task: row.task,
    due_date: row.dueDate,
    position: row.position,
    updated_at: row.updatedAt || new Date().toISOString()
  };
}

function mapKanbanFromDb(row) {
  return {
    id: row.card_key ?? row.id,
    accountId: row.account_id ?? row.accountId,
    accountName: row.account_name ?? row.accountName,
    owner: row.owner,
    stage: row.stage,
    score: row.score,
    task: row.task,
    dueDate: row.due_date ?? row.dueDate,
    position: row.position ?? 0,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

function mapAgentRunToDb(row) {
  return {
    run_key: row.id,
    account_id: row.accountId,
    agent_id: row.agentId,
    agent_name: row.agentName,
    priority: row.priority,
    summary: row.summary,
    actions: row.actions,
    tags: row.tags,
    run_at: row.runAt
  };
}

function mapConnectorRunToDb(row) {
  return {
    run_key: row.id,
    account_id: row.accountId,
    connector: row.connector,
    signal_count: row.signalCount,
    positive_count: row.positiveCount,
    negative_count: row.negativeCount,
    run_at: row.runAt
  };
}

function mapScoreHistoryToDb(row) {
  return {
    account_id: row.accountId,
    score: row.score,
    band: row.band,
    observed_at: row.observedAt
  };
}

function mapScoreHistoryFromDb(row) {
  return {
    accountId: row.account_id ?? row.accountId,
    score: row.score,
    band: row.band,
    observedAt: row.observed_at ?? row.observedAt
  };
}

function compareDatesAsc(a, b) {
  return new Date(a).getTime() - new Date(b).getTime();
}

class InMemoryStore {
  constructor() {
    this.tables = {
      atlas_accounts: structuredClone(seedAccounts),
      atlas_contacts: structuredClone(seedContacts),
      atlas_opportunities: [],
      atlas_signals: [],
      atlas_briefs: [],
      atlas_activities: [],
      atlas_kanban_cards: [],
      atlas_agent_runs: [],
      atlas_connector_runs: [],
      atlas_score_history: [],
      atlas_org_charts: Object.entries(seedOrgCharts).map(([accountId, chart]) => ({
        accountId,
        chart
      }))
    };
  }

  async select(table) {
    return structuredClone(this.tables[table] || []);
  }

  async insert(table, payload) {
    const rows = Array.isArray(payload) ? payload : [payload];
    this.tables[table] = [...(this.tables[table] || []), ...rows];
    return structuredClone(rows);
  }

  async upsert(table, payload, key = "id") {
    const rows = Array.isArray(payload) ? payload : [payload];
    const existing = this.tables[table] || [];

    rows.forEach((row) => {
      const index = existing.findIndex((entry) => entry[key] === row[key]);
      if (index >= 0) {
        existing[index] = { ...existing[index], ...row };
      } else {
        existing.push(row);
      }
    });

    this.tables[table] = existing;
    return structuredClone(rows);
  }
}

export class AtlasRepository {
  constructor() {
    this.supabase = new SupabaseClient({
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    });
    this.memory = new InMemoryStore();
  }

  get usingSupabase() {
    return this.supabase.enabled;
  }

  setAccessToken(token) {
    this.supabase.setAccessToken(token);
  }

  async listAccounts() {
    if (this.usingSupabase) {
      const rows = await this.supabase.select("atlas_accounts");
      return rows.map(mapAccountFromDb);
    }

    return this.memory.select("atlas_accounts");
  }

  async listContacts() {
    if (this.usingSupabase) {
      const rows = await this.supabase.select("atlas_contacts");
      return rows.map(mapContactFromDb);
    }

    return this.memory.select("atlas_contacts");
  }

  async listOrgCharts() {
    if (this.usingSupabase) {
      const rows = await this.supabase.select("atlas_org_charts");
      return rows.map(mapOrgChartFromDb);
    }

    return this.memory.select("atlas_org_charts");
  }

  async listKanbanCards() {
    if (this.usingSupabase) {
      const rows = await this.supabase.select("atlas_kanban_cards", {
        order: { column: "position", ascending: true }
      });
      return rows.map(mapKanbanFromDb);
    }

    return this.memory.select("atlas_kanban_cards");
  }

  async listRecentScoreHistory(limit = 120) {
    if (this.usingSupabase) {
      const rows = await this.supabase.select("atlas_score_history", {
        order: { column: "observed_at", ascending: false },
        limit
      });
      return rows.map(mapScoreHistoryFromDb).reverse();
    }

    const rows = await this.memory.select("atlas_score_history");
    return rows.sort((a, b) => compareDatesAsc(a.observedAt, b.observedAt)).slice(-limit);
  }

  async writeSignals(signalRows) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_signals", signalRows.map(mapSignalToDb));
    }

    return this.memory.insert("atlas_signals", signalRows);
  }

  async writeOpportunities(rows) {
    if (this.usingSupabase) {
      return this.supabase.upsert("atlas_opportunities", rows.map(mapOpportunityToDb), {
        onConflict: "account_id"
      });
    }

    return this.memory.upsert("atlas_opportunities", rows, "accountId");
  }

  async writeBrief(row) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_briefs", mapBriefToDb(row));
    }

    return this.memory.insert("atlas_briefs", row);
  }

  async appendActivities(rows) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_activities", rows.map(mapActivityToDb));
    }

    return this.memory.insert("atlas_activities", rows);
  }

  async upsertKanbanCards(rows) {
    if (this.usingSupabase) {
      return this.supabase.upsert("atlas_kanban_cards", rows.map(mapKanbanToDb), {
        onConflict: "card_key"
      });
    }

    return this.memory.upsert("atlas_kanban_cards", rows, "id");
  }

  async appendAgentRuns(rows) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_agent_runs", rows.map(mapAgentRunToDb));
    }

    return this.memory.insert("atlas_agent_runs", rows);
  }

  async appendConnectorRuns(rows) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_connector_runs", rows.map(mapConnectorRunToDb));
    }

    return this.memory.insert("atlas_connector_runs", rows);
  }

  async appendScoreHistory(rows) {
    if (this.usingSupabase) {
      return this.supabase.insert("atlas_score_history", rows.map(mapScoreHistoryToDb));
    }

    return this.memory.insert("atlas_score_history", rows);
  }
}
