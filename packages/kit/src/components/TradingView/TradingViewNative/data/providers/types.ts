import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import type { IMarketKLinePointType } from '../../../utils/fetchMarketKLineData';
import type { ITradingViewNativeKLineInterval } from '../tradingViewNativeIntervals';

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

export interface ITradingViewNativeHistoryPageInfo {
  historySource?: 'fallback';
  interval: ITradingViewNativeKLineInterval;
  receivedPointCount: number;
}

export interface ITradingViewNativeHistoryResponse extends IMarketTokenKLineResponse {
  historySource?: 'fallback';
  pointType?: IMarketKLinePointType;
}

export interface ITradingViewNativeHistoryDataProvider {
  getHistoryRequestCandleCount: (
    interval: ITradingViewNativeKLineInterval,
  ) => number;
  hasMoreHistory: (page: ITradingViewNativeHistoryPageInfo) => boolean;
  fetchHistory: (
    request: ITradingViewNativeHistoryRequest,
  ) => Promise<ITradingViewNativeHistoryResponse | null>;
}

export interface ITradingViewNativeDataProvider extends ITradingViewNativeHistoryDataProvider {
  historyRefreshInterval?: number;
  isReady: boolean;
  key: string;
  supportsRealtime: boolean;
  subscribeRealtime: (
    request: ITradingViewNativeRealtimeSubscriptionRequest,
  ) => Promise<ITradingViewNativeRealtimeSubscription | null>;
}
