import { OpportunityTable } from "./OpportunityTable";
import { SignalPanel } from "./SignalPanel";
import { ConnectorHealth } from "./ConnectorHealth";
import { ScoreTrend } from "./ScoreTrend";
import { AgentWorkbench } from "./AgentWorkbench";

function MetricCards({ metrics }) {
  const cards = [
    {
      label: "Accounts in Play",
      value: metrics.accounts,
      detail: `${metrics.signalCount} total live signals`
    },
    {
      label: "Avg Opportunity Score",
      value: metrics.avgScore,
      detail: `${metrics.tierOne} Tier 1 opportunities`
    },
    {
      label: "Modeled ARR Potential",
      value: `$${metrics.totalPotential.toLocaleString()}`,
      detail: "Across current target portfolio"
    },
    {
      label: "Connector Warnings",
      value: metrics.connectorWarnings,
      detail: "Connectors with negative signal skew"
    }
  ];

  return (
    <div className="metric-grid metric-grid-four">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <p>{card.label}</p>
          <h2>{card.value}</h2>
          <span>{card.detail}</span>
        </article>
      ))}
    </div>
  );
}

function ActivityFeed({ activity }) {
  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Live Activity</h2>
        <p>Recent autonomous updates and recommendations</p>
      </div>

      <ul className="activity-feed">
        {activity.map((row) => (
          <li key={row.id}>
            <strong>{row.actor}</strong>
            <p>{row.message}</p>
            <span>{new Date(row.timestamp).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Dashboard({ workspace, metrics }) {
  return (
    <div className="atlas-stack">
      <MetricCards metrics={metrics} />
      <OpportunityTable opportunities={workspace.opportunities} />
      <SignalPanel
        opportunities={workspace.opportunities}
        signalProfilesByAccount={workspace.signalProfilesByAccount}
      />
      <ConnectorHealth connectorHealth={workspace.connectorHealth} />
      <ScoreTrend scoreTrend={workspace.scoreTrend} />
      <AgentWorkbench
        opportunities={workspace.opportunities}
        agentInsightsByAccount={workspace.agentInsightsByAccount}
      />
      <ActivityFeed activity={workspace.activity} />
    </div>
  );
}
