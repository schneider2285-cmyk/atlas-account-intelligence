export function SignalPanel({ opportunities, signalProfilesByAccount }) {
  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Signal Engine</h2>
        <p>Connector-derived positive and risk indicators</p>
      </div>

      <div className="signal-list">
        {opportunities.slice(0, 4).map((opportunity) => {
          const profile = signalProfilesByAccount[opportunity.accountId];
          return (
            <article className="signal-card" key={opportunity.accountId}>
              <h3>{opportunity.account.name}</h3>
              <p className="signal-meta">
                Momentum {Math.round(profile.momentum.momentum)} | +{profile.momentum.positiveCount} / -
                {profile.momentum.negativeCount}
              </p>
              <ul>
                {profile.summary.topSignals.slice(0, 3).map((signal) => (
                  <li key={signal.id}>
                    <span className={signal.direction === "positive" ? "signal-good" : "signal-risk"}>
                      {signal.direction === "positive" ? "Up" : "Risk"}
                    </span>
                    <div>
                      <strong>{signal.label}</strong>
                      <p>{signal.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
