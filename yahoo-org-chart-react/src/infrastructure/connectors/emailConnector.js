import { BaseConnector } from "./baseConnector";

export class EmailConnector extends BaseConnector {
  constructor() {
    super("email");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 23);
    const replyRate = Math.round(18 + seed * 40);

    const signals = [
      {
        category: "email",
        label: `${replyRate}% positive reply rate over the last 7 days`,
        detail: `Reply sentiment trend for ${account.name} is above team median.`,
        direction: replyRate >= 30 ? "positive" : "negative",
        weight: replyRate >= 30 ? 7 : 4,
        confidence: 0.74,
        observedAt: this.hoursAgo(5)
      }
    ];

    if (seed < 0.34) {
      signals.push({
        category: "email",
        label: "High latency on stakeholder responses",
        detail: "Median response time moved above 72 hours.",
        direction: "negative",
        weight: 5,
        confidence: 0.68,
        observedAt: this.hoursAgo(14)
      });
    }

    return { connector: this.name, signals };
  }
}
