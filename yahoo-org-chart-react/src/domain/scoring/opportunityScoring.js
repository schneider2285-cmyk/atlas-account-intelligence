function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePotential(arrPotential) {
  return clamp((arrPotential / 700000) * 100, 5, 100);
}

function industryFit(industry) {
  const fitTable = {
    FinTech: 92,
    Healthcare: 86,
    Cybersecurity: 94,
    Industrial: 78,
    "Retail Tech": 74
  };

  return fitTable[industry] || 70;
}

function stageVelocity(stage) {
  const stageTable = {
    Discovery: 52,
    Evaluation: 63,
    "Technical Validation": 71,
    Proposal: 80,
    Negotiation: 88
  };

  return stageTable[stage] || 60;
}

function engagementScore(signals) {
  if (!signals.length) return 45;

  const engagementSignals = signals.filter((signal) =>
    ["email", "crm", "usage", "intent"].includes(signal.category)
  );

  if (!engagementSignals.length) return 42;

  const score = engagementSignals.reduce((sum, signal) => {
    const multiplier = signal.direction === "positive" ? 1 : -0.7;
    return sum + signal.weight * signal.confidence * multiplier;
  }, 50);

  return clamp(score, 0, 100);
}

function riskPenalty(signals) {
  const riskSignals = signals.filter((signal) => signal.direction === "negative");

  if (!riskSignals.length) return 0;

  const penalty = riskSignals.reduce(
    (sum, signal) => sum + signal.weight * signal.confidence * 0.55,
    0
  );

  return clamp(penalty, 0, 22);
}

function scoreBand(score) {
  if (score >= 85) return "Tier 1";
  if (score >= 70) return "Tier 2";
  if (score >= 55) return "Tier 3";
  return "Tier 4";
}

export function scoreOpportunity(account, signalProfile) {
  const potential = normalizePotential(account.arrPotential);
  const fit = industryFit(account.industry);
  const velocity = stageVelocity(account.stage);
  const momentum = clamp(50 + signalProfile.momentum.momentum, 0, 100);
  const engagement = engagementScore(signalProfile.signals);
  const penalty = riskPenalty(signalProfile.signals);

  const score = clamp(
    Math.round(
      potential * 0.22 +
        fit * 0.2 +
        velocity * 0.16 +
        momentum * 0.24 +
        engagement * 0.18 -
        penalty
    ),
    1,
    100
  );

  return {
    accountId: account.id,
    score,
    band: scoreBand(score),
    drivers: {
      potential,
      fit,
      velocity,
      momentum,
      engagement,
      riskPenalty: penalty
    },
    recommendedPlays: score >= 80
      ? ["Executive alignment", "Multi-thread outreach", "Commercial proposal"]
      : score >= 65
        ? ["Champion validation", "Discovery expansion", "Security pre-read"]
        : ["Re-qualification", "Signal watch", "Nurture motion"]
  };
}
