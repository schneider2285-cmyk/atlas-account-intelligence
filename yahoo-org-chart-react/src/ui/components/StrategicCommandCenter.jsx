import { useMemo, useState } from "react";

function impactScore(signal) {
  const direction = signal.direction === "positive" ? 1 : -1;
  return direction * signal.weight * signal.confidence;
}

function prettyCategory(category) {
  return (category || "general")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatHoursAgo(isoValue) {
  const diffMs = Date.now() - new Date(isoValue).getTime();
  const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  return `${hours}h ago`;
}

function influenceClass(influence) {
  if (influence === "high") return "influence-high";
  if (influence === "medium") return "influence-medium";
  return "influence-low";
}

function summarizeOrgTree(root) {
  if (!root) {
    return {
      totalNodes: 0,
      maxDepth: 0,
      directReports: 0
    };
  }

  let totalNodes = 0;
  let maxDepth = 0;

  const walk = (node, depth) => {
    totalNodes += 1;
    maxDepth = Math.max(maxDepth, depth);
    (node.children || []).forEach((child) => walk(child, depth + 1));
  };

  walk(root, 1);

  return {
    totalNodes,
    maxDepth,
    directReports: root.children?.length || 0
  };
}

function scoreSparkline(points) {
  if (!points?.length) return "";
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const values = points.map((point) => point.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);

  return values
    .map((value) => {
      const idx = Math.round(((value - min) / spread) * (chars.length - 1));
      return chars[idx];
    })
    .join("");
}

function toActionRows(insights) {
  return insights
    .flatMap((insight) =>
      (insight.actions || []).slice(0, 2).map((action, index) => ({
        key: `${insight.id}-${index}`,
        agent: insight.name,
        priority: insight.priority,
        action
      }))
    )
    .slice(0, 8);
}

export function StrategicCommandCenter({ workspace }) {
  const opportunities = workspace.opportunities || [];
  const [selectedAccountId, setSelectedAccountId] = useState(opportunities[0]?.accountId || "");
  const [query, setQuery] = useState("");

  const activeOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.accountId === selectedAccountId) || opportunities[0],
    [opportunities, selectedAccountId]
  );

  const accountId = activeOpportunity?.accountId;
  const signalProfile = accountId ? workspace.signalProfilesByAccount[accountId] : null;
  const contacts = accountId ? workspace.contactsByAccount[accountId] || [] : [];
  const orgChart = accountId ? workspace.orgChartsByAccount[accountId] : null;
  const insights = accountId ? workspace.agentInsightsByAccount[accountId] || [] : [];
  const trend = (workspace.scoreTrend || []).find((row) => row.accountId === accountId);
  const kanbanCard = (workspace.kanban?.cards || []).find((card) => card.accountId === accountId);

  const filteredSignals = useMemo(() => {
    const signals = signalProfile?.signals || [];
    const normalized = query.trim().toLowerCase();
    return signals
      .filter((signal) => {
        if (!normalized) return true;
        const text = `${signal.label} ${signal.detail || ""} ${signal.category} ${signal.connector}`.toLowerCase();
        return text.includes(normalized);
      })
      .sort((a, b) => Math.abs(impactScore(b)) - Math.abs(impactScore(a)));
  }, [signalProfile, query]);

  const categoryPressure = useMemo(() => {
    const byCategory = signalProfile?.summary?.byCategory || {};
    return Object.entries(byCategory)
      .map(([category, stats]) => ({
        category,
        positive: stats.positive,
        negative: stats.negative,
        totalWeight: stats.totalWeight,
        net: stats.positive - stats.negative
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
  }, [signalProfile]);

  const orgStats = useMemo(() => summarizeOrgTree(orgChart), [orgChart]);
  const actionRows = useMemo(() => toActionRows(insights), [insights]);

  const influenceCounts = contacts.reduce(
    (counts, contact) => {
      if (contact.influence === "high") counts.high += 1;
      else if (contact.influence === "medium") counts.medium += 1;
      else counts.low += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 }
  );

  if (!activeOpportunity) {
    return (
      <section className="atlas-panel">
        <div className="panel-head">
          <h2>Command Center</h2>
          <p>No opportunities available.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="atlas-panel command-shell">
      <div className="panel-head command-head">
        <div>
          <h2>Strategic Command Center</h2>
          <p>Per-account intelligence cockpit with signal pressure, org leverage, and execution plays.</p>
        </div>
        <div className="command-search">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter signals, connectors, or categories"
          />
        </div>
      </div>

      <div className="command-account-switcher" role="tablist" aria-label="Account switcher">
        {opportunities.map((opportunity) => (
          <button
            key={opportunity.accountId}
            type="button"
            role="tab"
            aria-selected={opportunity.accountId === accountId}
            className={opportunity.accountId === accountId ? "active" : ""}
            onClick={() => setSelectedAccountId(opportunity.accountId)}
          >
            <span>{opportunity.account.name}</span>
            <strong>{opportunity.score}</strong>
          </button>
        ))}
      </div>

      <div className="command-metrics">
        <article className="command-metric score">
          <p>Opportunity Score</p>
          <h3>{activeOpportunity.score}</h3>
          <span>{activeOpportunity.band}</span>
        </article>

        <article className="command-metric momentum">
          <p>Signal Momentum</p>
          <h3>{Math.round(signalProfile?.momentum?.momentum || 0)}</h3>
          <span>
            +{signalProfile?.momentum?.positiveCount || 0} / -{signalProfile?.momentum?.negativeCount || 0}
          </span>
        </article>

        <article className="command-metric value">
          <p>ARR Potential</p>
          <h3>${activeOpportunity.account.arrPotential.toLocaleString()}</h3>
          <span>{activeOpportunity.account.stage}</span>
        </article>

        <article className="command-metric trend">
          <p>Score Trend</p>
          <h3>{trend?.currentScore || activeOpportunity.score}</h3>
          <span className="sparkline">{scoreSparkline(trend?.points || [])}</span>
        </article>
      </div>

      <div className="command-grid-two">
        <article className="command-card">
          <header>
            <h3>Live Signal Tape</h3>
            <p>{filteredSignals.length} signals</p>
          </header>
          <ul className="signal-tape">
            {filteredSignals.slice(0, 10).map((signal) => (
              <li key={signal.id}>
                <span className={signal.direction === "positive" ? "dir-good" : "dir-risk"}>
                  {signal.direction === "positive" ? "Up" : "Risk"}
                </span>
                <div>
                  <strong>{signal.label}</strong>
                  <p>{signal.detail}</p>
                  <small>
                    {prettyCategory(signal.category)} · {signal.connector} · {formatHoursAgo(signal.observedAt)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="command-card">
          <header>
            <h3>Category Pressure</h3>
            <p>Weighted signal concentration</p>
          </header>
          <div className="category-pressure-list">
            {categoryPressure.map((row) => (
              <div key={row.category} className="category-row">
                <div className="category-top">
                  <strong>{prettyCategory(row.category)}</strong>
                  <span>
                    +{row.positive} / -{row.negative}
                  </span>
                </div>
                <div className="pressure-bar">
                  <div
                    className={row.net >= 0 ? "pressure-fill positive" : "pressure-fill negative"}
                    style={{
                      width: `${Math.max(8, Math.min(100, row.totalWeight * 8))}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="command-grid-two">
        <article className="command-card">
          <header>
            <h3>Buying Committee Radar</h3>
            <p>
              High influence: {influenceCounts.high} · Medium: {influenceCounts.medium} · Low: {influenceCounts.low}
            </p>
          </header>
          <div className="committee-list">
            {contacts.map((contact) => (
              <article key={contact.id}>
                <div>
                  <strong>{contact.name}</strong>
                  <p>{contact.title}</p>
                </div>
                <span className={`influence-chip ${influenceClass(contact.influence)}`}>{contact.influence}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="command-card">
          <header>
            <h3>Org Coverage Snapshot</h3>
            <p>
              {orgStats.totalNodes} mapped nodes · {orgStats.directReports} direct reports · depth {orgStats.maxDepth}
            </p>
          </header>
          {orgChart ? (
            <div className="org-snapshot">
              <article className="org-leader">
                <strong>{orgChart.name}</strong>
                <p>{orgChart.title}</p>
              </article>
              <div className="org-directs">
                {(orgChart.children || []).map((node) => (
                  <article key={node.id}>
                    <strong>{node.name}</strong>
                    <p>{node.title}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p>No org chart available.</p>
          )}
        </article>
      </div>

      <div className="command-grid-two">
        <article className="command-card">
          <header>
            <h3>Priority Plays (Next 72h)</h3>
            <p>Cross-agent actions sorted by urgency</p>
          </header>
          <ul className="play-list">
            {actionRows.map((row) => (
              <li key={row.key}>
                <span className={`priority-tag ${row.priority}`}>{row.priority}</span>
                <div>
                  <strong>{row.agent}</strong>
                  <p>{row.action}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="command-card">
          <header>
            <h3>Outreach Flight Deck</h3>
            <p>Current execution state for this account</p>
          </header>
          <div className="flight-deck">
            <div>
              <p>Owner</p>
              <strong>{kanbanCard?.owner || activeOpportunity.account.owner}</strong>
            </div>
            <div>
              <p>Stage</p>
              <strong>{kanbanCard?.stage || "research"}</strong>
            </div>
            <div>
              <p>Due</p>
              <strong>{kanbanCard?.dueDate ? new Date(kanbanCard.dueDate).toLocaleDateString() : "TBD"}</strong>
            </div>
            <div className="full">
              <p>Next Task</p>
              <strong>{kanbanCard?.task || "Prepare discovery brief and outreach sequence."}</strong>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
