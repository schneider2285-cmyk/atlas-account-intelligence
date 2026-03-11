import { BaseConnector } from "./baseConnector";

export class IntentConnector extends BaseConnector {
  constructor() {
    super("intent");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 79);
    const topic = seed > 0.5 ? "pipeline quality" : "forecast reliability";

    return {
      connector: this.name,
      signals: [
        {
          category: "intent",
          label: `Intent surge detected around ${topic}`,
          detail: `${account.name} showed above-baseline research activity for ${topic}.`,
          direction: "positive",
          weight: 7,
          confidence: 0.77,
          observedAt: this.hoursAgo(7)
        }
      ]
    };
  }
}
