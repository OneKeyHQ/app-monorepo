type ISubscription = {
  address: string;
  connectionCount: number;
};

export class ServiceMarketWSConnectionManager {
  private subscriptions: ISubscription[] = [];

  addSubscription(address: string) {
    const existing = this.subscriptions.find((sub) => sub.address === address);
    if (existing) {
      existing.connectionCount += 1;
    } else {
      this.subscriptions.push({ address, connectionCount: 1 });
    }
  }

  removeSubscription(address: string) {
    const existingIndex = this.subscriptions.findIndex(
      (sub) => sub.address === address,
    );
    if (existingIndex !== -1) {
      const existing = this.subscriptions[existingIndex];
      existing.connectionCount -= 1;
      if (existing.connectionCount <= 0) {
        this.subscriptions.splice(existingIndex, 1);
      }
    }
  }

  getSubscriptions(): ISubscription[] {
    return [...this.subscriptions];
  }

  hasSubscription(address: string): boolean {
    return this.subscriptions.some((sub) => sub.address === address);
  }

  clear() {
    this.subscriptions = [];
  }
}
