import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import type { IMarketKLinePointType } from '../../../utils/fetchMarketKLineData';
import type { ITradingViewNativeCandleTimeMode } from '../../types';
import type {
  ITradingViewNativeChartInterval,
  ITradingViewNativeKLineInterval,
} from '../tradingViewNativeIntervals';

// Rate-limited retries of one chart in a row. All requests of the chart share
// the object, so each chart gives up on its own; a success starts it over.
export interface ITradingViewNativeRateLimitRetries {
  used: number;
}

export interface ITradingViewNativeHistoryRequest {
  // Initial/latest and backward pagination may cross non-trading windows.
  allowEarlierHistory?: boolean;
  // A load of the latest candles, whose end moves to the time of a retry.
  // A chart drops live updates until this history loads.
  followsLatest?: boolean;
  interval: ITradingViewNativeKLineInterval;
  rateLimitRetries?: ITradingViewNativeRateLimitRetries;
  signal: AbortSignal;
  timeFrom: number;
  timeTo: number;
  // False fails a rate-limited request at once instead of waiting it out,
  // for background requests no chart cancels when it goes away.
  waitOutRateLimit?: boolean;
}

export interface ITradingViewNativeRealtimeSubscription {
  ensure: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export type ITradingViewNativeRealtimeUpdate =
  | IMarketTokenKLineDataPoint
  | { price: number; t: number };

export interface ITradingViewNativeRealtimeSubscriptionRequest {
  interval: ITradingViewNativeKLineInterval;
  getActiveInterval?: () => ITradingViewNativeKLineInterval;
  onPoint: (point: ITradingViewNativeRealtimeUpdate) => void;
  // For history a subscription loads, e.g. the daily candles of 1W/1M.
  rateLimitRetries?: ITradingViewNativeRateLimitRetries;
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
  getCandleTimeMode?: () => ITradingViewNativeCandleTimeMode;
  getInitialHistoryRequestCandleCount?: (
    interval: ITradingViewNativeKLineInterval,
  ) => number;
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
  realtimeInterval?: ITradingViewNativeChartInterval;
  isReady: boolean;
  key: string;
  supportsRealtime: boolean;
  subscribeRealtime: (
    request: ITradingViewNativeRealtimeSubscriptionRequest,
  ) => Promise<ITradingViewNativeRealtimeSubscription | null>;
}
