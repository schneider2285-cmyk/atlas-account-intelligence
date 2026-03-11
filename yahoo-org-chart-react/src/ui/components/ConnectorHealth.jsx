export function ConnectorHealth({ connectorHealth }) {
  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Connector Health</h2>
        <p>Runtime signal quality by connector service</p>
      </div>

      <div className="connector-grid">
        {connectorHealth.map((item) => (
          <article key={item.connector} className="connector-card">
            <header>
              <h3>{item.connector}</h3>
              <span className={item.health === "stable" ? "health-stable" : "health-warning"}>
                {item.health}
              </span>
            </header>
            <p>{item.signalCount} signals</p>
            <small>
              +{item.positiveCount} / -{item.negativeCount} over {item.runs} account runs
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
