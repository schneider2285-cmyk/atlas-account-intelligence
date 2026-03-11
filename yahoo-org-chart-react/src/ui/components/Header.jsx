export function Header({
  activeView,
  onChangeView,
  generatedAt,
  dataSource,
  onRefresh,
  refreshing,
  userEmail,
  onSignOut
}) {
  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "kanban", label: "Outreach Kanban" },
    { id: "org", label: "Org Chart Explorer" },
    { id: "brief", label: "Daily Strategy Brief" }
  ];

  return (
    <header className="atlas-header">
      <div>
        <p className="atlas-eyebrow">Atlas Account Intelligence</p>
        <h1>Revenue Intelligence Control Center</h1>
        <p className="atlas-meta">
          Generated {new Date(generatedAt || Date.now()).toLocaleString()} | Data source: {dataSource}
        </p>
      </div>

      <div className="atlas-header-controls">
        <div className="session-row">
          <span>{userEmail || "Authenticated user"}</span>
          <button type="button" className="signout-btn" onClick={onSignOut}>
            Sign Out
          </button>
        </div>

        <button type="button" className="refresh-btn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh Signals"}
        </button>

        <nav className="atlas-nav" aria-label="Atlas views">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={activeView === view.id ? "active" : ""}
              onClick={() => onChangeView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
