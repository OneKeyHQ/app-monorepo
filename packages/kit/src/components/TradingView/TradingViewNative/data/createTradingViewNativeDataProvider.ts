import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { fetchMarketKLineDataWithSlicing } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  isMarketWsOhlcvData,
  normalizeMarketWsKLineInterval,
} from '@onekeyhq/shared/src/utils/marketWsUtils';
import type { IMarketWsDataUpdatePayload } from '@onekeyhq/shared/types/marketV2';

import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';
import { tradingViewNativeHyperliquidGateway } from './tradingViewNativeHyperliquidGateway';

import type {
  ITradingViewNativeDataProvider,
  ITradingViewNativeRealtimeSubscription,
  ITradingViewNativeRealtimeSubscriptionRequest,
} from './tradingViewNativeDataProviderTypes';
import type { ITradingViewNativeSource } from '../types';

const MARKET_WS_CURRENCY = 'usd';

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function createMarketDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'market' }>,
): ITradingViewNativeDataProvider {
  const subscriptionBase = {
    networkId: source.networkId,
    tokenAddress: source.tokenAddress,
    symbol: source.symbol,
    currency: MARKET_WS_CURRENCY,
  };

  return {
    isReady: Boolean(
      source.networkId && (source.tokenAddress || source.symbol),
    ),
    key: `market:${source.networkId}:${source.tokenAddress}:${normalizeSymbol(
      source.symbol,
    )}`,
    supportsRealtime: source.realtime === 'websocket',
    fetchHistory: async ({ interval, timeFrom, timeTo }) =>
      fetchMarketKLineDataWithSlicing({
        tokenAddress: source.tokenAddress,
        networkId: source.networkId,
        interval: interval.label,
        timeFrom,
        timeTo,
        autoHandleError: false,
      }),
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
            normalizeSymbol(payload.data.symbol) !==
              normalizeSymbol(source.symbol))
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

function createHyperliquidDataProvider(
  source: Extract<ITradingViewNativeSource, { kind: 'hyperliquid' }>,
): ITradingViewNativeDataProvider {
  return {
    isReady: Boolean(source.coin),
    key: `hyperliquid:${source.environment}:${source.coin}`,
    supportsRealtime: true,
    fetchHistory: ({ interval, signal, timeFrom, timeTo }) =>
      tradingViewNativeHyperliquidGateway.fetchCandles({
        coin: source.coin,
        environment: source.environment,
        interval: interval.hyperliquidValue,
        signal,
        timeFrom,
        timeTo,
      }),
    subscribeRealtime: ({ interval, onPoint, signal, subscriberId }) =>
      signal.aborted
        ? Promise.resolve(null)
        : tradingViewNativeHyperliquidGateway.subscribeCandle({
            coin: source.coin,
            environment: source.environment,
            interval: interval.hyperliquidValue,
            listener: onPoint,
            subscriberId,
          }),
  };
}

export function createTradingViewNativeDataProvider(
  source: ITradingViewNativeSource,
): ITradingViewNativeDataProvider {
  return source.kind === 'hyperliquid'
    ? createHyperliquidDataProvider(source)
    : createMarketDataProvider(source);
}
