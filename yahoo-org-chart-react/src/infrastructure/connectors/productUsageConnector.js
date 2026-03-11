import { BaseConnector } from "./baseConnector";

export class ProductUsageConnector extends BaseConnector {
  constructor() {
    super("usage");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 37);
    const weeklyActiveUsers = Math.round(15 + seed * 120);

    return {
      connector: this.name,
      signals: [
        {
          category: "usage",
          label: `${weeklyActiveUsers} pilot users active in sandbox`,
          detail: "Usage telemetry from controlled pilot workspace.",
          direction: weeklyActiveUsers >= 50 ? "positive" : "negative",
          weight: weeklyActiveUsers >= 50 ? 8 : 3,
          confidence: 0.81,
          observedAt: this.hoursAgo(4)
        }
      ]
    };
  }
}
