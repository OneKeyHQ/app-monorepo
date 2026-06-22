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

type ISubscriptionQuery = {
  address: string;
  type: ISubscriptionType;
  networkId?: string;
  chartType?: string;
  currency?: string;
};

export class MarketSubscriptionTracker {
  private subscriptions: ISubscription[] = [];

  private static readonly DATA_COUNT_THRESHOLD = 100;

  private matchesSubscription(
    sub: ISubscription,
    { address, type, networkId, chartType, currency }: ISubscriptionQuery,
  ) {
    return (
      sub.address === address &&
      sub.type === type &&
      (networkId === undefined || sub.networkId === networkId) &&
      (chartType === undefined || sub.chartType === chartType) &&
      (currency === undefined || sub.currency === currency)
    );
  }

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

  getSubscriptionsByParams(params: ISubscriptionQuery): ISubscription[] {
    return this.subscriptions.filter((sub) =>
      this.matchesSubscription(sub, params),
    );
  }

  hasSubscription(params: ISubscriptionQuery): boolean {
    return this.subscriptions.some((sub) =>
      this.matchesSubscription(sub, params),
    );
  }

  hasExactSubscription({
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
  }): boolean {
    return this.subscriptions.some(
      (sub) =>
        sub.address === address &&
        sub.type === type &&
        sub.networkId === networkId &&
        sub.chartType === chartType &&
        sub.currency === currency,
    );
  }

  getSubscription(params: ISubscriptionQuery): ISubscription | undefined {
    return this.subscriptions.find((sub) =>
      this.matchesSubscription(sub, params),
    );
  }

  clearDataCount(params: ISubscriptionQuery): boolean {
    const existing = this.getSubscription(params);
    if (existing) {
      existing.dataCount = 0;
      return true;
    }
    return false;
  }

  incrementDataCount(params: ISubscriptionQuery): number {
    const existing = this.getSubscription(params);
    if (existing) {
      existing.dataCount += 1;
      return existing.dataCount;
    }
    return 0;
  }

  getDataCount(params: ISubscriptionQuery): number {
    const existing = this.getSubscription(params);
    return existing ? existing.dataCount : 0;
  }

  shouldUnsubscribe({
    address,
    type,
    networkId,
    chartType,
    currency,
    threshold,
  }: {
    address: string;
    type: ISubscriptionType;
    networkId?: string;
    chartType?: string;
    currency?: string;
    threshold: number;
  }): boolean {
    const existing = this.getSubscription({
      address,
      type,
      networkId,
      chartType,
      currency,
    });
    return existing ? existing.dataCount >= threshold : false;
  }

  shouldUnsubscribeWithDefaultThreshold({
    address,
    type,
    networkId,
    chartType,
    currency,
  }: {
    address: string;
    type: ISubscriptionType;
    networkId?: string;
    chartType?: string;
    currency?: string;
  }): boolean {
    return this.shouldUnsubscribe({
      address,
      type,
      networkId,
      chartType,
      currency,
      threshold: MarketSubscriptionTracker.DATA_COUNT_THRESHOLD,
    });
  }

  clear() {
    this.subscriptions = [];
  }
}
