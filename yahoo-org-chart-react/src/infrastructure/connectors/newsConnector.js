import { BaseConnector } from "./baseConnector";

export class NewsConnector extends BaseConnector {
  constructor() {
    super("news");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 49);

    const positiveEvent = {
      category: "news",
      label: `${account.name} announced growth initiative aligned to revenue efficiency`,
      detail: "Public release indicates operating model modernization focus.",
      direction: "positive",
      weight: 6,
      confidence: 0.66,
      observedAt: this.hoursAgo(22)
    };

    const riskEvent = {
      category: "news",
      label: `${account.name} leadership transition introduces procurement uncertainty`,
      detail: "Role transition could delay approvals this month.",
      direction: "negative",
      weight: 5,
      confidence: 0.6,
      observedAt: this.hoursAgo(30)
    };

    return {
      connector: this.name,
      signals: [seed > 0.45 ? positiveEvent : riskEvent]
    };
  }
}
