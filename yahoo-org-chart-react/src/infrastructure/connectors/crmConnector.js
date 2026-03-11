import { BaseConnector } from "./baseConnector";

export class CrmConnector extends BaseConnector {
  constructor() {
    super("crm");
  }

  async collect(account) {
    const seed = this.seedValue(account.id, 11);
    const hasCompetitor = seed > 0.62;

    const signals = [
      {
        category: "crm",
        label: `${account.stage} stage progression confirmed in CRM notes`,
        detail: `${account.name} moved through ${account.stage} with updated stakeholder notes.`,
        direction: "positive",
        weight: 6 + Math.round(seed * 2),
        confidence: 0.72,
        observedAt: this.hoursAgo(9)
      }
    ];

    if (hasCompetitor) {
      signals.push({
        category: "crm",
        label: "Competitor mentioned during latest qualification call",
        detail: "competitor reference captured by AE in notes",
        direction: "negative",
        weight: 4,
        confidence: 0.65,
        observedAt: this.hoursAgo(16)
      });
    }

    return { connector: this.name, signals };
  }
}
