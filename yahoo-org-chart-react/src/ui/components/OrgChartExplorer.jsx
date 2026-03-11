import { useMemo, useState } from "react";

function walk(node, callback) {
  callback(node);
  (node.children || []).forEach((child) => walk(child, callback));
}

function nodeMatches(node, query) {
  if (!query) return true;
  const text = `${node.name} ${node.title} ${node.department || ""}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

function TreeNode({ node, expanded, onToggle, query }) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = Boolean(node.children?.length);
  const visible = nodeMatches(node, query);

  if (!visible && !hasChildren) {
    return null;
  }

  return (
    <li>
      <div className="org-node">
        <button
          type="button"
          className="org-toggle"
          disabled={!hasChildren}
          onClick={() => hasChildren && onToggle(node.id)}
          aria-label={hasChildren ? `Toggle ${node.name}` : `${node.name} has no direct reports`}
        >
          {hasChildren ? (isExpanded ? "-" : "+") : "•"}
        </button>
        <div>
          <strong>{node.name}</strong>
          <p>{node.title}</p>
          <span>{node.department}</span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} expanded={expanded} onToggle={onToggle} query={query} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChartExplorer({ opportunities, orgChartsByAccount }) {
  const [selectedAccountId, setSelectedAccountId] = useState(opportunities[0]?.accountId || "");
  const [query, setQuery] = useState("");

  const currentChart = orgChartsByAccount[selectedAccountId];

  const defaultExpanded = useMemo(() => {
    if (!currentChart) return new Set();
    const ids = new Set([currentChart.id]);
    walk(currentChart, (node) => {
      if ((node.children || []).length > 0 && node.id === currentChart.id) {
        ids.add(node.id);
      }
    });
    return ids;
  }, [currentChart]);

  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleNode = (id) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (event) => {
    const accountId = event.target.value;
    setSelectedAccountId(accountId);
    const chart = orgChartsByAccount[accountId];
    setExpanded(new Set(chart ? [chart.id] : []));
  };

  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Org Chart Explorer</h2>
        <p>Browse reporting lines and identify outreach paths</p>
      </div>

      <div className="org-toolbar">
        <label>
          Account
          <select value={selectedAccountId} onChange={handleSelect}>
            {opportunities.map((opportunity) => (
              <option key={opportunity.accountId} value={opportunity.accountId}>
                {opportunity.account.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Role, team, or person"
          />
        </label>
      </div>

      {!currentChart ? (
        <p>No org chart found for selected account.</p>
      ) : (
        <div className="org-tree">
          <ul>
            <TreeNode node={currentChart} expanded={expanded} onToggle={toggleNode} query={query} />
          </ul>
        </div>
      )}
    </section>
  );
}
