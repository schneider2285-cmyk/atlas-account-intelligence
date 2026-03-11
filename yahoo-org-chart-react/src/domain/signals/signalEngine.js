const POSITIVE = "positive";
const NEGATIVE = "negative";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toEpoch(value) {
  return new Date(value).getTime();
}

export function normalizeSignals(accountId, connectorResults) {
  return connectorResults.flatMap((result) =>
    result.signals.map((signal, index) => ({
      id: `${accountId}-${result.connector}-${index}`,
      accountId,
      connector: result.connector,
      category: signal.category,
      label: signal.label,
      detail: signal.detail,
      direction: signal.direction === NEGATIVE ? NEGATIVE : POSITIVE,
      weight: clamp(Number(signal.weight) || 1, 1, 10),
      confidence: clamp(Number(signal.confidence) || 0.4, 0.05, 1),
      observedAt: signal.observedAt,
      freshnessHours: Math.max(1, Math.round((Date.now() - toEpoch(signal.observedAt)) / (1000 * 60 * 60)))
    }))
  );
}

export function scoreSignalMomentum(signals) {
  if (!signals.length) {
    return {
      momentum: 0,
      positiveCount: 0,
      negativeCount: 0,
      averageConfidence: 0,
      weightedImpact: 0
    };
  }

  const weightedImpact = signals.reduce((sum, signal) => {
    const signedWeight = signal.direction === POSITIVE ? signal.weight : -signal.weight;
    return sum + signedWeight * signal.confidence;
  }, 0);

  const positiveCount = signals.filter((signal) => signal.direction === POSITIVE).length;
  const negativeCount = signals.length - positiveCount;
  const averageConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;

  return {
    momentum: clamp(weightedImpact, -100, 100),
    positiveCount,
    negativeCount,
    averageConfidence,
    weightedImpact
  };
}

export function buildSignalSummary(signals) {
  const byCategory = signals.reduce((acc, signal) => {
    const key = signal.category || "general";
    if (!acc[key]) {
      acc[key] = { positive: 0, negative: 0, totalWeight: 0 };
    }

    if (signal.direction === POSITIVE) {
      acc[key].positive += 1;
    } else {
      acc[key].negative += 1;
    }

    acc[key].totalWeight += signal.weight;
    return acc;
  }, {});

  const topSignals = [...signals]
    .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
    .slice(0, 5);

  return { byCategory, topSignals };
}

export function runSignalEngine(accountId, connectorResults) {
  const signals = normalizeSignals(accountId, connectorResults);
  const momentum = scoreSignalMomentum(signals);
  const summary = buildSignalSummary(signals);

  return {
    accountId,
    signals,
    momentum,
    summary,
    updatedAt: new Date().toISOString()
  };
}
