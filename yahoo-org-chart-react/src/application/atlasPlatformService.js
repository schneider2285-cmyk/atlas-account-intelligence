import { ConnectorRegistry } from "../infrastructure/connectors/connectorRegistry";
import { AtlasRepository } from "../infrastructure/data/supabase/atlasRepository";
import { runSignalEngine } from "../domain/signals/signalEngine";
import { scoreOpportunity } from "../domain/scoring/opportunityScoring";
import { runAllAgents } from "../domain/agents/agentCatalog";
import { generateDailyStrategyBrief } from "../domain/briefs/dailyStrategyBrief";
import { KANBAN_STAGES, getStageTitle, moveStage } from "../domain/kanban/stages";

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function flattenActivityRows(opportunities, insightsByAccount) {
  return opportunities.slice(0, 8).map((opportunity, index) => {
    const topInsight = (insightsByAccount[opportunity.accountId] || [])[0];
    return {
      id: `${opportunity.accountId}-${Date.now()}-${index}`,
      accountId: opportunity.accountId,
      actor: opportunity.account.owner,
      message: topInsight ? topInsight.summary : "Opportunity evaluated",
      timestamp: new Date(Date.now() - index * 35 * 60000).toISOString()
    };
  });
}

function buildConnectorRunRows(accountId, connectorResults, runAt) {
  return connectorResults.map((connectorResult) => {
    const positiveCount = connectorResult.signals.filter((signal) => signal.direction === "positive").length;
    const negativeCount = connectorResult.signals.length - positiveCount;

    return {
      id: `${accountId}-${connectorResult.connector}-${runAt}`,
      accountId,
      connector: connectorResult.connector,
      signalCount: connectorResult.signals.length,
      positiveCount,
      negativeCount,
      runAt
    };
  });
}

function buildAgentRunRows(accountId, agentInsights, runAt) {
  return agentInsights.map((insight) => ({
    id: `${accountId}-${insight.id}-${runAt}`,
    accountId,
    agentId: insight.id,
    agentName: insight.name,
    priority: insight.priority,
    summary: insight.summary,
    actions: insight.actions,
    tags: insight.tags,
    runAt
  }));
}

function stageColumns() {
  return KANBAN_STAGES.map((stageId) => ({
    id: stageId,
    title: getStageTitle(stageId)
  }));
}

function defaultCardForOpportunity(opportunity, insights, position) {
  const stage = KANBAN_STAGES[Math.min(KANBAN_STAGES.length - 1, Math.floor((opportunity.score - 40) / 13))] || "research";
  const keyInsight = insights[10] || insights[0];

  const dueDate = new Date(Date.now() + (position + 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return {
    id: `kb-${opportunity.accountId}`,
    accountId: opportunity.accountId,
    accountName: opportunity.account.name,
    owner: opportunity.account.owner,
    stage,
    score: opportunity.score,
    task: keyInsight?.actions?.[0] || "Prepare next outreach touch",
    dueDate,
    position,
    updatedAt: new Date().toISOString()
  };
}

function reconcileKanbanCards(opportunities, insightsByAccount, persistedCards) {
  const persistedById = new Map((persistedCards || []).map((card) => [card.id, card]));

  const merged = opportunities.map((opportunity, index) => {
    const base = defaultCardForOpportunity(opportunity, insightsByAccount[opportunity.accountId] || [], index);
    const persisted = persistedById.get(base.id);

    if (!persisted) return base;

    return {
      ...base,
      stage: persisted.stage || base.stage,
      task: persisted.task || base.task,
      dueDate: persisted.dueDate || base.dueDate,
      position: typeof persisted.position === "number" ? persisted.position : index,
      updatedAt: persisted.updatedAt || base.updatedAt
    };
  });

  merged.sort((a, b) => {
    const stageDiff = KANBAN_STAGES.indexOf(a.stage) - KANBAN_STAGES.indexOf(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return (a.position || 0) - (b.position || 0);
  });

  return merged.map((card, index) => ({ ...card, position: index }));
}

function summarizeConnectorHealth(connectorRuns) {
  const grouped = groupBy(connectorRuns, (row) => row.connector);

  return Object.entries(grouped).map(([connector, runs]) => {
    const signalCount = runs.reduce((sum, row) => sum + row.signalCount, 0);
    const positiveCount = runs.reduce((sum, row) => sum + row.positiveCount, 0);
    const negativeCount = runs.reduce((sum, row) => sum + row.negativeCount, 0);

    return {
      connector,
      runs: runs.length,
      signalCount,
      positiveCount,
      negativeCount,
      health: positiveCount >= negativeCount ? "stable" : "warning"
    };
  });
}

function buildScoreTrend(historyRows, opportunities) {
  const byAccount = groupBy(historyRows, (row) => row.accountId);

  return opportunities.map((opportunity) => {
    const points = (byAccount[opportunity.accountId] || []).slice(-7);
    return {
      accountId: opportunity.accountId,
      accountName: opportunity.account.name,
      currentScore: opportunity.score,
      points
    };
  });
}

function assembleKanban(cards) {
  return {
    columns: stageColumns(),
    cards
  };
}

export class AtlasPlatformService {
  constructor({ repository = new AtlasRepository(), connectors = new ConnectorRegistry() } = {}) {
    this.repository = repository;
    this.connectors = connectors;
  }

  setAccessToken(token) {
    if (typeof this.repository.setAccessToken === "function") {
      this.repository.setAccessToken(token);
    }
  }

  async buildDailyWorkspace({ date = new Date().toISOString() } = {}) {
    const runAt = new Date().toISOString();

    const [accounts, contacts, orgRows, persistedCards, scoreHistoryRows] = await Promise.all([
      this.repository.listAccounts(),
      this.repository.listContacts(),
      this.repository.listOrgCharts(),
      this.repository.listKanbanCards(),
      this.repository.listRecentScoreHistory(240)
    ]);

    const contactsByAccount = groupBy(contacts, (contact) => contact.accountId);
    const orgChartsByAccount = orgRows.reduce((acc, row) => {
      acc[row.account_id || row.accountId] = row.chart;
      return acc;
    }, {});

    const signalProfilesByAccount = {};
    const agentInsightsByAccount = {};
    const connectorRunsByAccount = {};

    const scoredOpportunities = [];
    const connectorRunRows = [];
    const agentRunRows = [];

    for (const account of accounts) {
      const connectorResults = await this.connectors.collectForAccount(account);
      const signalProfile = runSignalEngine(account.id, connectorResults);
      const opportunity = scoreOpportunity(account, signalProfile);
      const context = {
        account,
        contacts: contactsByAccount[account.id] || [],
        signals: signalProfile.signals,
        opportunity
      };

      const agentInsights = runAllAgents(context);

      signalProfilesByAccount[account.id] = signalProfile;
      agentInsightsByAccount[account.id] = agentInsights;
      connectorRunsByAccount[account.id] = connectorResults;

      connectorRunRows.push(...buildConnectorRunRows(account.id, connectorResults, runAt));
      agentRunRows.push(...buildAgentRunRows(account.id, agentInsights, runAt));

      scoredOpportunities.push({
        ...opportunity,
        account,
        accountId: account.id
      });
    }

    scoredOpportunities.sort((a, b) => b.score - a.score);

    const strategyBrief = generateDailyStrategyBrief({
      date,
      opportunities: scoredOpportunities,
      agentInsightsByAccount,
      signalProfilesByAccount
    });

    const allSignals = Object.values(signalProfilesByAccount).flatMap((profile) => profile.signals);
    const activityRows = flattenActivityRows(scoredOpportunities, agentInsightsByAccount);
    const scoreRows = scoredOpportunities.map((opportunity) => ({
      accountId: opportunity.accountId,
      score: opportunity.score,
      band: opportunity.band,
      observedAt: runAt
    }));

    const kanbanCards = reconcileKanbanCards(scoredOpportunities, agentInsightsByAccount, persistedCards);

    const persistenceResults = await Promise.allSettled([
      this.repository.writeSignals(allSignals),
      this.repository.writeOpportunities(
        scoredOpportunities.map((opportunity) => ({
          accountId: opportunity.accountId,
          score: opportunity.score,
          band: opportunity.band,
          drivers: opportunity.drivers,
          updatedAt: runAt
        }))
      ),
      this.repository.writeBrief({
        id: `brief-${new Date(date).toISOString().slice(0, 10)}`,
        generatedAt: strategyBrief.generatedAt,
        headline: strategyBrief.headline,
        markdown: strategyBrief.markdown
      }),
      this.repository.appendActivities(activityRows),
      this.repository.appendAgentRuns(agentRunRows),
      this.repository.appendConnectorRuns(connectorRunRows),
      this.repository.appendScoreHistory(scoreRows),
      this.repository.upsertKanbanCards(kanbanCards)
    ]);

    const persistenceWarnings = persistenceResults
      .filter((result) => result.status === "rejected")
      .map((result) => String(result.reason?.message || result.reason || "Unknown persistence error"));

    const nextScoreHistory = [...scoreHistoryRows, ...scoreRows].slice(-240);

    return {
      generatedAt: strategyBrief.generatedAt,
      dataSource: this.repository.usingSupabase ? "supabase" : "in-memory",
      accounts,
      contactsByAccount,
      orgChartsByAccount,
      signalProfilesByAccount,
      connectorRunsByAccount,
      connectorHealth: summarizeConnectorHealth(connectorRunRows),
      agentInsightsByAccount,
      opportunities: scoredOpportunities,
      scoreTrend: buildScoreTrend(nextScoreHistory, scoredOpportunities),
      strategyBrief,
      activity: activityRows,
      kanban: assembleKanban(kanbanCards),
      persistenceWarnings
    };
  }

  async moveKanbanCard({ kanban, cardId, direction, actor = "Atlas User" }) {
    const nextCards = kanban.cards.map((card) => {
      if (card.id !== cardId) return card;

      return {
        ...card,
        stage: moveStage(card.stage, direction),
        updatedAt: new Date().toISOString()
      };
    });

    nextCards.sort((a, b) => {
      const stageDiff = KANBAN_STAGES.indexOf(a.stage) - KANBAN_STAGES.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return (a.position || 0) - (b.position || 0);
    });

    const normalized = nextCards.map((card, index) => ({ ...card, position: index }));

    const moved = normalized.find((card) => card.id === cardId);

    await Promise.all([
      this.repository.upsertKanbanCards(normalized),
      moved
        ? this.repository.appendActivities([
            {
              id: `mv-${cardId}-${Date.now()}`,
              accountId: moved.accountId,
              actor,
              message: `Moved outreach card for ${moved.accountName} to ${getStageTitle(moved.stage)}`,
              timestamp: new Date().toISOString()
            }
          ])
        : Promise.resolve([])
    ]);

    return assembleKanban(normalized);
  }
}
