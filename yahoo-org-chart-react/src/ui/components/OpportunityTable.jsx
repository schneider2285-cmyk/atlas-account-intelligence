function scoreClass(score) {
  if (score >= 85) return "score-high";
  if (score >= 70) return "score-medium";
  return "score-low";
}

export function OpportunityTable({ opportunities }) {
  return (
    <section className="atlas-panel">
      <div className="panel-head">
        <h2>Opportunity Scoring</h2>
        <p>Prioritized by Atlas weighted model</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Owner</th>
              <th>Stage</th>
              <th>Potential</th>
              <th>Score</th>
              <th>Band</th>
              <th>Top Plays</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opportunity) => (
              <tr key={opportunity.accountId}>
                <td>{opportunity.account.name}</td>
                <td>{opportunity.account.owner}</td>
                <td>{opportunity.account.stage}</td>
                <td>${opportunity.account.arrPotential.toLocaleString()}</td>
                <td>
                  <span className={`score-pill ${scoreClass(opportunity.score)}`}>{opportunity.score}</span>
                </td>
                <td>{opportunity.band}</td>
                <td>{opportunity.recommendedPlays.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
