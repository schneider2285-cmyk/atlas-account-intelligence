import { useMemo, useState } from "react";

export function AgentWorkbench({ opportunities, agentInsightsByAccount }) {
  const [accountId, setAccountId] = useState(opportunities[0]?.accountId || "");

  const activeAccount = useMemo(
    () => opportunities.find((opportunity) => opportunity.accountId === accountId) || opportunities[0],
    [opportunities, accountId]
  );

  const insights = activeAccount ? agentInsightsByAccount[activeAccount.accountId] || [] : [];

  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Agent Workbench</h2>
        <p>Full 12-agent recommendations for a selected account</p>
      </div>

      <div className="agent-workbench-toolbar">
        <label>
          Account
          <select value={activeAccount?.accountId || ""} onChange={(event) => setAccountId(event.target.value)}>
            {opportunities.map((opportunity) => (
              <option key={opportunity.accountId} value={opportunity.accountId}>
                {opportunity.account.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="agent-workbench-grid">
        {insights.map((insight) => (
          <article key={insight.id} className="agent-workbench-card">
            <header>
              <h3>{insight.name}</h3>
              <span className={`priority-${insight.priority}`}>{insight.priority}</span>
            </header>
            <p>{insight.summary}</p>
            <ul>
              {insight.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
