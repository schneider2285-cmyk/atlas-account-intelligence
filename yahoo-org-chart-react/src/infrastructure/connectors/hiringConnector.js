import { BaseConnector } from "./baseConnector";

export class HiringConnector extends BaseConnector {
  constructor() {
    super("hiring");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 61);
    const hiringCount = Math.round(seed * 8);

    return {
      connector: this.name,
      signals: [
        {
          category: "hiring",
          label: `${hiringCount} GTM systems roles posted in last 30 days`,
          detail: "Talent demand suggests active process and systems investment.",
          direction: hiringCount >= 3 ? "positive" : "negative",
          weight: hiringCount >= 3 ? 5 : 3,
          confidence: 0.64,
          observedAt: this.hoursAgo(36)
        }
      ]
    };
  }
}
