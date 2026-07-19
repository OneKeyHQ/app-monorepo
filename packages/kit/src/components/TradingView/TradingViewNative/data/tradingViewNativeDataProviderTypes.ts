import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeKLineInterval } from './tradingViewNativeIntervals';

export interface ITradingViewNativeHistoryRequest {
  interval: ITradingViewNativeKLineInterval;
  signal: AbortSignal;
  timeFrom: number;
  timeTo: number;
}

export interface ITradingViewNativeRealtimeSubscription {
  ensure: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export interface ITradingViewNativeRealtimeSubscriptionRequest {
  interval: ITradingViewNativeKLineInterval;
  onPoint: (point: IMarketTokenKLineDataPoint) => void;
  signal: AbortSignal;
  subscriberId: string;
}

export interface ITradingViewNativeDataProvider {
  isReady: boolean;
  key: string;
  supportsRealtime: boolean;
  fetchHistory: (
    request: ITradingViewNativeHistoryRequest,
  ) => Promise<IMarketTokenKLineResponse | null>;
  subscribeRealtime: (
    request: ITradingViewNativeRealtimeSubscriptionRequest,
  ) => Promise<ITradingViewNativeRealtimeSubscription | null>;
}
