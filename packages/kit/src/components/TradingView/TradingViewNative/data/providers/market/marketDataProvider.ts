import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IMarketKLinePointType,
  fetchMarketKLineData,
} from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  isMarketWsOhlcvData,
  normalizeMarketWsKLineInterval,
} from '@onekeyhq/shared/src/utils/marketWsUtils';
import type { IMarketWsDataUpdatePayload } from '@onekeyhq/shared/types/marketV2';

import {
  getTradingViewNativeMarketTokenKey,
  getTradingViewNativeSourceKey,
} from '../../getTradingViewNativeSource';
import { logTradingViewNativeDataError } from '../../tradingViewNativeDataLogger';

import type { ITradingViewNativeSource } from '../../../types';
import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeHistoryDataProvider,
  ITradingViewNativeRealtimeSubscription,
  ITradingViewNativeRealtimeSubscriptionRequest,
} from '../types';

const MARKET_WS_CURRENCY = 'usd';
const MARKET_CONTRACT_HISTORY_PAGE_SIZE = 299;
const MARKET_NATIVE_HISTORY_PAGE_SIZE = 200;
const MARKET_HISTORY_REQUEST_CANDLE_COUNT = 2000;
const MARKET_HISTORY_SOURCE_CACHE_MAX_SIZE = 100;

// This main-runtime cache survives chart remounts and resets with the UI runtime.
const unavailableMarketHistoryTokenKeys = new Set<string>();

function cacheUnavailableMarketHistoryTokenKey(tokenKey: string) {
  unavailableMarketHistoryTokenKeys.delete(tokenKey);
  unavailableMarketHistoryTokenKeys.add(tokenKey);
  if (
    unavailableMarketHistoryTokenKeys.size <=
    MARKET_HISTORY_SOURCE_CACHE_MAX_SIZE
  ) {
    return;
  }

  const oldestTokenKey = unavailableMarketHistoryTokenKeys
    .values()
    .next().value;
  if (oldestTokenKey) {
    unavailableMarketHistoryTokenKeys.delete(oldestTokenKey);
  }
}

export function clearTradingViewNativeMarketDataProviderCache() {
  unavailableMarketHistoryTokenKeys.clear();
}

function normalizeMarketWsSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function createTradingViewNativeMarketDataProvider({
  fallbackHistoryProvider,
  source,
}: {
  fallbackHistoryProvider: ITradingViewNativeHistoryDataProvider;
  source: Extract<ITradingViewNativeSource, { kind: 'market' }>;
}): ITradingViewNativeDataProvider {
  const marketTokenKey = getTradingViewNativeMarketTokenKey(source);
  const normalizedFallbackCoinGeckoId = source.fallbackCoinGeckoId?.trim();
  const canUseMarketHistory = Boolean(
    source.networkId && (source.tokenAddress || source.symbol),
  );
  let primaryHistoryUnavailable =
    !canUseMarketHistory ||
    unavailableMarketHistoryTokenKeys.has(marketTokenKey);
  const marketHistoryPageSize = source.tokenAddress.trim()
    ? MARKET_CONTRACT_HISTORY_PAGE_SIZE
    : MARKET_NATIVE_HISTORY_PAGE_SIZE;
  const subscriptionBase = {
    networkId: source.networkId,
    tokenAddress: source.tokenAddress,
    symbol: source.symbol,
    currency: MARKET_WS_CURRENCY,
  };

  return {
    getHistoryRequestCandleCount: (interval) =>
      primaryHistoryUnavailable
        ? fallbackHistoryProvider.getHistoryRequestCandleCount(interval)
        : MARKET_HISTORY_REQUEST_CANDLE_COUNT,
    hasMoreHistory: (page) =>
      page.historySource === 'fallback'
        ? fallbackHistoryProvider.hasMoreHistory(page)
        : !primaryHistoryUnavailable &&
          page.receivedPointCount >= marketHistoryPageSize,
    isReady: canUseMarketHistory || Boolean(normalizedFallbackCoinGeckoId),
    key: getTradingViewNativeSourceKey(source),
    supportsRealtime: source.realtime === 'websocket',
    fetchHistory: async (request) => {
      const { interval, signal, timeFrom, timeTo } = request;
      let pointType: IMarketKLinePointType | undefined;
      let usedFallback = false;
      const data = await fetchMarketKLineData({
        tokenAddress: source.tokenAddress,
        networkId: source.networkId,
        interval: interval.label,
        timeFrom,
        timeTo,
        autoHandleError: false,
        kLineDataFallback: async (fallbackRequest: {
          timeFrom: number;
          timeTo: number;
        }) => {
          const fallbackTimeFrom = Math.max(
            fallbackRequest.timeTo -
              interval.seconds *
                fallbackHistoryProvider.getHistoryRequestCandleCount(interval),
            0,
          );
          return fallbackHistoryProvider.fetchHistory({
            interval,
            signal,
            timeFrom: Math.min(fallbackRequest.timeFrom, fallbackTimeFrom),
            timeTo: fallbackRequest.timeTo,
          });
        },
        onFallbackKLineData: () => {
          usedFallback = true;
        },
        onPrimaryKLineDataUnavailable: () => {
          primaryHistoryUnavailable = true;
          cacheUnavailableMarketHistoryTokenKey(marketTokenKey);
        },
        onPointType: (nextPointType) => {
          pointType = nextPointType;
        },
        primaryKLineDataUnavailable: primaryHistoryUnavailable,
      });
      if (!data) {
        return null;
      }
      return {
        ...data,
        ...(usedFallback ? { historySource: 'fallback' as const } : {}),
        ...(pointType ? { pointType } : {}),
      };
    },
    subscribeRealtime: async ({
      interval,
      onPoint,
      signal,
    }: ITradingViewNativeRealtimeSubscriptionRequest): Promise<ITradingViewNativeRealtimeSubscription | null> => {
      if (source.realtime !== 'websocket' || signal.aborted) {
        return null;
      }

      const subscription = {
        ...subscriptionBase,
        chartType: interval.marketWsValue,
      };
      let isClosed = false;
      let isAborted = false;
      let didSubscribe = false;
      let leaseMutation = Promise.resolve();
      const enqueueLeaseMutation = (mutation: () => Promise<void>) => {
        const nextMutation = leaseMutation
          .catch(() => undefined)
          .then(mutation);
        leaseMutation = nextMutation.catch(() => undefined);
        return nextMutation;
      };
      const handleMarketDataUpdate = (payload: IMarketWsDataUpdatePayload) => {
        if (
          isClosed ||
          isAborted ||
          payload.channel !== 'ohlcv' ||
          payload.tokenAddress !== source.tokenAddress ||
          (payload.networkId && payload.networkId !== source.networkId) ||
          (!payload.networkId && payload.isSubscriptionAmbiguous) ||
          !isMarketWsOhlcvData(payload.data) ||
          normalizeMarketWsKLineInterval(payload.data.type) !==
            interval.marketWsValue ||
          (!source.tokenAddress &&
            normalizeMarketWsSymbol(payload.data.symbol) !==
              normalizeMarketWsSymbol(source.symbol))
        ) {
          return;
        }

        onPoint({
          o: payload.data.o,
          h: payload.data.h,
          l: payload.data.l,
          c: payload.data.c,
          v: payload.data.v,
          t: payload.data.unixTime,
        });
        void backgroundApiProxy.serviceMarketWS
          .clearDataCount({
            address: source.tokenAddress,
            type: 'ohlcv',
            networkId: source.networkId,
            chartType: interval.marketWsValue,
            currency: MARKET_WS_CURRENCY,
          })
          .catch((error: unknown) => {
            logTradingViewNativeDataError(
              'Failed to clear native TradingView market data count',
              error,
            );
          });
      };

      appEventBus.on(
        EAppEventBusNames.MarketWSDataUpdate,
        handleMarketDataUpdate,
      );
      const handleAbort = () => {
        isAborted = true;
        appEventBus.off(
          EAppEventBusNames.MarketWSDataUpdate,
          handleMarketDataUpdate,
        );
      };
      signal.addEventListener('abort', handleAbort, { once: true });

      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        if (isAborted) {
          signal.removeEventListener('abort', handleAbort);
          return null;
        }
        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV(subscription);
        didSubscribe = true;
        if (isAborted) {
          didSubscribe = false;
          await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV(
            subscription,
          );
          signal.removeEventListener('abort', handleAbort);
          return null;
        }
      } catch (error) {
        signal.removeEventListener('abort', handleAbort);
        appEventBus.off(
          EAppEventBusNames.MarketWSDataUpdate,
          handleMarketDataUpdate,
        );
        throw error;
      }

      return {
        ensure: () =>
          enqueueLeaseMutation(async () => {
            if (isClosed || isAborted) {
              return;
            }
            await backgroundApiProxy.serviceMarketWS.connect();
            if (isClosed || isAborted) {
              return;
            }
            await backgroundApiProxy.serviceMarketWS.ensureSubscription({
              ...subscription,
              channel: 'ohlcv',
            });
          }),
        unsubscribe: async () => {
          if (isClosed) {
            return;
          }
          isClosed = true;
          signal.removeEventListener('abort', handleAbort);
          appEventBus.off(
            EAppEventBusNames.MarketWSDataUpdate,
            handleMarketDataUpdate,
          );
          await enqueueLeaseMutation(async () => {
            if (didSubscribe) {
              didSubscribe = false;
              await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV(
                subscription,
              );
            }
          });
        },
      };
    },
  };
}
