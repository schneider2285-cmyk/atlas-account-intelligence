export class BaseConnector {
  constructor(name) {
    this.name = name;
  }

  async collect() {
    throw new Error(`collect() not implemented for ${this.name}`);
  }

  hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }

  seedValue(accountId, salt = 1) {
    const chars = `${accountId}:${this.name}:${salt}`.split("");
    const value = chars.reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
    return (value % 1000) / 1000;
  }
}
