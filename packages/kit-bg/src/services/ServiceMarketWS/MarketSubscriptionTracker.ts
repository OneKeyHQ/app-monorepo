import type { EChannel } from './const';

type ISubscriptionType = (typeof EChannel)[keyof typeof EChannel];

type ISubscription = {
  address: string;
  type: ISubscriptionType;
  connectionCount: number;
};

export class MarketSubscriptionTracker {
  private subscriptions: ISubscription[] = [];

  addSubscription(address: string, type: ISubscriptionType) {
    const existing = this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
    if (existing) {
      existing.connectionCount += 1;
    } else {
      this.subscriptions.push({ address, type, connectionCount: 1 });
    }
  }

  removeSubscription(address: string, type: ISubscriptionType) {
    const existingIndex = this.subscriptions.findIndex(
      (sub) => sub.address === address && sub.type === type,
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

  getSubscriptionsByType(type: ISubscriptionType): ISubscription[] {
    return this.subscriptions.filter((sub) => sub.type === type);
  }

  hasSubscription(address: string, type: ISubscriptionType): boolean {
    return this.subscriptions.some(
      (sub) => sub.address === address && sub.type === type,
    );
  }

  clear() {
    this.subscriptions = [];
  }
}
