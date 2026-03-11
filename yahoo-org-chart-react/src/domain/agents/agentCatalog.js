function pickSignal(signals, category, fallbackLabel) {
  const found = signals
    .filter((signal) => signal.category === category)
    .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)[0];

  if (found) return found.label;
  return fallbackLabel;
}

function countByDirection(signals) {
  return signals.reduce(
    (acc, signal) => {
      if (signal.direction === "positive") acc.positive += 1;
      else acc.negative += 1;
      return acc;
    },
    { positive: 0, negative: 0 }
  );
}

const AGENTS = [
  {
    id: "agent-01-icp-fit",
    name: "ICP Fit Agent",
    run: ({ account, opportunity }) => ({
      summary: `${account.industry} fit is ${Math.round(opportunity.drivers.fit)} with ${account.segment} segment alignment.`,
      priority: opportunity.drivers.fit >= 85 ? "high" : "medium",
      actions: [
        "Validate strategic initiative alignment with active buying committee",
        "Confirm current tooling maturity against Atlas deployment blueprint"
      ],
      tags: ["fit", "qualification"]
    })
  },
  {
    id: "agent-02-trigger-events",
    name: "Trigger Event Agent",
    run: ({ signals }) => ({
      summary: pickSignal(signals, "news", "No fresh trigger event in last 24h."),
      priority: signals.some((signal) => signal.category === "news" && signal.direction === "positive") ? "high" : "low",
      actions: [
        "Attach trigger evidence in account plan",
        "Craft event-led outreach opener"
      ],
      tags: ["timing", "events"]
    })
  },
  {
    id: "agent-03-buying-committee",
    name: "Buying Committee Agent",
    run: ({ contacts }) => {
      const highInfluence = contacts.filter((contact) => contact.influence === "high").length;
      return {
        summary: `${contacts.length} known stakeholders, ${highInfluence} with high influence mapped.`,
        priority: highInfluence >= 2 ? "medium" : "high",
        actions: [
          "Map legal, finance, and security counterparts",
          "Identify missing economic buyer"
        ],
        tags: ["stakeholders", "multi-thread"]
      };
    }
  },
  {
    id: "agent-04-champion",
    name: "Champion Agent",
    run: ({ signals, contacts }) => {
      const engagement = signals.filter((signal) => signal.category === "email" && signal.direction === "positive").length;
      return {
        summary: engagement > 0
          ? "Champion behavior detected from recent engaged responses."
          : "Champion confidence is low; no clear internal mobilizer yet.",
        priority: engagement > 0 ? "medium" : "high",
        actions: [
          `Prioritize 1:1 follow-up with ${contacts[0]?.name || "primary stakeholder"}`,
          "Offer internal business case one-pager"
        ],
        tags: ["champion", "engagement"]
      };
    }
  },
  {
    id: "agent-05-risk",
    name: "Risk Agent",
    run: ({ signals }) => {
      const directionCounts = countByDirection(signals);
      return {
        summary: `${directionCounts.negative} risk signals vs ${directionCounts.positive} positive signals in current window.`,
        priority: directionCounts.negative > 3 ? "high" : "medium",
        actions: [
          "Address procurement and security blockers in next sync",
          "Prepare mitigation FAQ for legal/security review"
        ],
        tags: ["risk", "blockers"]
      };
    }
  },
  {
    id: "agent-06-messaging",
    name: "Messaging Agent",
    run: ({ account, signals }) => ({
      summary: `Recommended message for ${account.name}: tie ROI to ${pickSignal(signals, "intent", "operational efficiency initiative")}.`,
      priority: "medium",
      actions: [
        "Draft role-specific message variants for technical and executive tracks",
        "Anchor value proposition on measurable week-4 outcomes"
      ],
      tags: ["outreach", "copy"]
    })
  },
  {
    id: "agent-07-sequencing",
    name: "Sequencing Agent",
    run: ({ opportunity }) => ({
      summary: `Current score ${opportunity.score} (${opportunity.band}) suggests accelerated 5-touch sequence.`,
      priority: opportunity.score >= 75 ? "high" : "medium",
      actions: [
        "Run executive + practitioner dual-thread sequence",
        "Set 48h follow-up SLA on replied contacts"
      ],
      tags: ["sequence", "cadence"]
    })
  },
  {
    id: "agent-08-pricing",
    name: "Pricing Strategy Agent",
    run: ({ account, opportunity }) => ({
      summary: `ARR potential $${account.arrPotential.toLocaleString()} supports ${opportunity.band} packaging strategy.`,
      priority: account.arrPotential >= 400000 ? "high" : "medium",
      actions: [
        "Prepare phased rollout pricing with pilot option",
        "Attach adoption-based expansion path"
      ],
      tags: ["commercial", "pricing"]
    })
  },
  {
    id: "agent-09-competitive-intel",
    name: "Competitive Intel Agent",
    run: ({ signals }) => ({
      summary: pickSignal(signals, "crm", "No active competitor detected in CRM notes this week."),
      priority: signals.some((signal) => signal.detail.toLowerCase().includes("competitor")) ? "high" : "low",
      actions: [
        "Position trust architecture and deployment speed differentiators",
        "Arm champion with side-by-side comparison sheet"
      ],
      tags: ["competition", "positioning"]
    })
  },
  {
    id: "agent-10-relationship-map",
    name: "Relationship Mapper Agent",
    run: ({ contacts }) => ({
      summary: `Current map covers ${contacts.length} contacts; prioritize cross-functional expansion by 2 contacts.`,
      priority: contacts.length >= 3 ? "low" : "medium",
      actions: [
        "Add finance and procurement stakeholders",
        "Capture reporting line influence paths in org chart"
      ],
      tags: ["org-chart", "relationships"]
    })
  },
  {
    id: "agent-11-next-best-action",
    name: "Next Best Action Agent",
    run: ({ account, opportunity }) => ({
      summary: opportunity.score >= 80
        ? `Schedule executive alignment call for ${account.name} within 48 hours.`
        : `Launch discovery reinforcement sequence for ${account.name}.`,
      priority: "high",
      actions: [
        "Send personalized recap with business case artifact",
        "Request calendar hold with economic buyer"
      ],
      tags: ["execution", "nba"]
    })
  },
  {
    id: "agent-12-strategy-brief",
    name: "Strategy Brief Agent",
    run: ({ account, opportunity, signals }) => ({
      summary: `Daily strategy brief prepared for ${account.name} with ${signals.length} active signals and score ${opportunity.score}.`,
      priority: "medium",
      actions: [
        "Publish account summary in morning standup",
        "Track delta in score after outreach cycle"
      ],
      tags: ["briefing", "daily"]
    })
  }
];

export function runAllAgents(context) {
  return AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    ...agent.run(context)
  }));
}

export function getAgentCatalog() {
  return AGENTS.map((agent) => ({ id: agent.id, name: agent.name }));
}
