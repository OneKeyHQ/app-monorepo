import type { EChannel } from './const';

export type ISubscriptionType = (typeof EChannel)[keyof typeof EChannel];

export type ISubscription = {
  address: string;
  type: ISubscriptionType;
  networkId: string;
  chartType?: string;
  currency?: string;
  connectionCount: number;
  dataCount: number;
};

export class MarketSubscriptionTracker {
  private subscriptions: ISubscription[] = [];

  private static readonly DATA_COUNT_THRESHOLD = 10;

  addSubscription({
    address,
    type,
    networkId,
    chartType,
    currency,
  }: {
    address: string;
    type: ISubscriptionType;
    networkId: string;
    chartType?: string;
    currency?: string;
  }) {
    const existing = this.subscriptions.find(
      (sub) =>
        sub.address === address &&
        sub.type === type &&
        sub.networkId === networkId &&
        sub.chartType === chartType &&
        sub.currency === currency,
    );
    if (existing) {
      existing.connectionCount += 1;
    } else {
      this.subscriptions.push({
        address,
        type,
        networkId,
        chartType,
        currency,
        connectionCount: 1,
        dataCount: 0,
      });
    }
  }

  removeSubscription({
    address,
    type,
    networkId,
    chartType,
    currency,
  }: {
    address: string;
    type: ISubscriptionType;
    networkId: string;
    chartType?: string;
    currency?: string;
  }) {
    const existingIndex = this.subscriptions.findIndex(
      (sub) =>
        sub.address === address &&
        sub.type === type &&
        sub.networkId === networkId &&
        sub.chartType === chartType &&
        sub.currency === currency,
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

  hasSubscription({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): boolean {
    return this.subscriptions.some(
      (sub) => sub.address === address && sub.type === type,
    );
  }

  getSubscription({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): ISubscription | undefined {
    return this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
  }

  clearDataCount({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): boolean {
    const existing = this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
    if (existing) {
      existing.dataCount = 0;
      return true;
    }
    return false;
  }

  incrementDataCount({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): number {
    const existing = this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
    if (existing) {
      existing.dataCount += 1;
      return existing.dataCount;
    }
    return 0;
  }

  getDataCount({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): number {
    const existing = this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
    return existing ? existing.dataCount : 0;
  }

  shouldUnsubscribe({
    address,
    type,
    threshold,
  }: {
    address: string;
    type: ISubscriptionType;
    threshold: number;
  }): boolean {
    const existing = this.subscriptions.find(
      (sub) => sub.address === address && sub.type === type,
    );
    return existing ? existing.dataCount >= threshold : false;
  }

  shouldUnsubscribeWithDefaultThreshold({
    address,
    type,
  }: {
    address: string;
    type: ISubscriptionType;
  }): boolean {
    return this.shouldUnsubscribe({
      address,
      type,
      threshold: MarketSubscriptionTracker.DATA_COUNT_THRESHOLD,
    });
  }

  clear() {
    this.subscriptions = [];
  }
}
