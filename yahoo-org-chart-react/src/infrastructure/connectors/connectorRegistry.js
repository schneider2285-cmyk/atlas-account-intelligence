import { CrmConnector } from "./crmConnector";
import { EmailConnector } from "./emailConnector";
import { ProductUsageConnector } from "./productUsageConnector";
import { NewsConnector } from "./newsConnector";
import { HiringConnector } from "./hiringConnector";
import { IntentConnector } from "./intentConnector";
import { DossierConnector } from "./dossierConnector";

export class ConnectorRegistry {
  constructor() {
    this.connectors = [
      new CrmConnector(),
      new EmailConnector(),
      new ProductUsageConnector(),
      new NewsConnector(),
      new HiringConnector(),
      new IntentConnector(),
      new DossierConnector()
    ];
  }

  async collectForAccount(account) {
    return Promise.all(this.connectors.map((connector) => connector.collect(account)));
  }
}
