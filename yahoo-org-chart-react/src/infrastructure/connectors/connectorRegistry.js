import { CrmConnector } from "./crmConnector";
import { EmailConnector } from "./emailConnector";
import { ProductUsageConnector } from "./productUsageConnector";
import { NewsConnector } from "./newsConnector";
import { HiringConnector } from "./hiringConnector";
import { IntentConnector } from "./intentConnector";

export class ConnectorRegistry {
  constructor() {
    this.connectors = [
      new CrmConnector(),
      new EmailConnector(),
      new ProductUsageConnector(),
      new NewsConnector(),
      new HiringConnector(),
      new IntentConnector()
    ];
  }

  async collectForAccount(account) {
    return Promise.all(this.connectors.map((connector) => connector.collect(account)));
  }
}
