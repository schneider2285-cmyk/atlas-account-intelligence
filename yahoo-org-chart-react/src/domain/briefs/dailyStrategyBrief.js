function summarizeThemes(agentInsightsByAccount) {
  const counts = {};

  Object.values(agentInsightsByAccount).forEach((insights) => {
    insights.forEach((insight) => {
      insight.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));
}

function topActions(opportunities, agentInsightsByAccount) {
  const actions = [];

  opportunities.slice(0, 3).forEach((opportunity) => {
    const insights = agentInsightsByAccount[opportunity.accountId] || [];
    const highPriority = insights.find((insight) => insight.priority === "high");

    if (highPriority) {
      actions.push({
        accountId: opportunity.accountId,
        score: opportunity.score,
        action: highPriority.actions[0],
        owner: opportunity.account.owner
      });
    }
  });

  return actions;
}

export function generateDailyStrategyBrief({ date, opportunities, agentInsightsByAccount, signalProfilesByAccount }) {
  const themes = summarizeThemes(agentInsightsByAccount);
  const actions = topActions(opportunities, agentInsightsByAccount);

  const headline = opportunities[0]
    ? `${opportunities[0].account.name} leads with score ${opportunities[0].score}`
    : "No opportunities available";

  const riskAccounts = opportunities
    .filter((opportunity) => signalProfilesByAccount[opportunity.accountId]?.momentum?.negativeCount > 3)
    .map((opportunity) => opportunity.account.name);

  const markdown = [
    `# Atlas Daily Strategy Brief - ${new Date(date).toLocaleDateString()}`,
    "",
    `## Headline`,
    headline,
    "",
    "## Top Actions",
    ...actions.map((entry, index) => `${index + 1}. ${entry.action} (${entry.owner})`),
    "",
    "## Priority Themes",
    ...themes.map((theme) => `- ${theme.tag}: ${theme.count} references`),
    "",
    "## Watchlist",
    riskAccounts.length ? riskAccounts.map((name) => `- ${name}`).join("\n") : "- No accounts currently flagged"
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    headline,
    themes,
    actions,
    riskAccounts,
    markdown
  };
}
