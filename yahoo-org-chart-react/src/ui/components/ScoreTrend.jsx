function normalizePoints(points, fallback) {
  if (!points?.length) return [fallback];
  return points.map((point) => point.score);
}

export function ScoreTrend({ scoreTrend }) {
  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Opportunity Trend</h2>
        <p>Recent score trajectory by account</p>
      </div>

      <div className="trend-grid">
        {scoreTrend.map((series) => {
          const values = normalizePoints(series.points, series.currentScore);
          const max = Math.max(...values, 1);

          return (
            <article key={series.accountId} className="trend-card">
              <header>
                <h3>{series.accountName}</h3>
                <strong>{series.currentScore}</strong>
              </header>

              <div className="sparkline" aria-label={`Score trend for ${series.accountName}`}>
                {values.map((value, index) => (
                  <span
                    key={`${series.accountId}-${index}`}
                    style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
                  />
                ))}
              </div>

              <small>{values.length} points retained</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
