import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  normalizeKLineForPage,
  normalizeTradingViewKLineInterval,
} from '../messageHandlers/klineDataHandler';

import type { IWebViewRef } from '../../../WebView/types';

interface IUseTradingViewV2WebSocketProps {
  networkId: string;
  tokenAddress: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  chartType?: string;
  currency?: string;
}

interface IMarketPriceUpdatePayload {
  channel: string;
  tokenAddress: string;
  messageType?: string;
  data: unknown;
  originalData?: unknown;
}

// The lowercase output here IS the wire format sent to the market WS backend.
// Delegate to the canonical normalizer (single source of truth) so the interval
// mapping lives in one place. The canonical normalizer returns one of a fixed
// set of recognized intervals (upper-cased h/d/w); for every such known value
// we lowercase it, producing output byte-identical to the previous explicit
// switch. For an unknown/unrecognized interval the canonical normalizer returns
// the raw value unchanged, which we pass through verbatim (no lowercasing) to
// preserve the previous passthrough behavior. The `|| '1m'` fallback covers the
// undefined/empty case.
const RECOGNIZED_KLINE_INTERVALS = new Set([
  '1m',
  '5m',
  '15m',
  '30m',
  '1H',
  '4H',
  '1D',
  '1W',
]);
function normalizeMarketWsKLineInterval(interval: string | undefined): string {
  if (!interval) {
    return '1m';
  }
  const normalized = normalizeTradingViewKLineInterval(interval);
  if (RECOGNIZED_KLINE_INTERVALS.has(normalized)) {
    return normalized.toLowerCase();
  }
  // Unknown interval: canonical normalizer returned the input unchanged.
  return normalized;
}

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
  enabled = true,
  chartType = '1m',
  currency = 'usd',
}: IUseTradingViewV2WebSocketProps): void {
  const lastUpdateTime = useRef<number>(0);
  const wsChartType = normalizeMarketWsKLineInterval(chartType);
  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled,
    networkId,
    tokenAddress,
    chartType: wsChartType,
    currency,
    channel: 'ohlcv',
  });
  useEffect(() => {
    if (!networkId || !tokenAddress) {
      return;
    }

    async function initWebSocket(): Promise<void> {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV({
          networkId,
          tokenAddress,
          chartType: wsChartType,
          currency,
        });
      } catch (error) {
        console.error('Failed to initialize market WebSocket:', error);
      }
    }

    // Capture whether THIS effect actually subscribed, so the cleanup only
    // unsubscribes a subscription it made. On a ref-counted backend an
    // unconditional unsubscribe would decrement a count this effect never
    // incremented, potentially tearing down another component's subscription.
    const didSubscribe = enabled;

    if (didSubscribe) {
      void initWebSocket();
    }

    return () => {
      if (!didSubscribe) {
        return;
      }

      async function cleanup(): Promise<void> {
        try {
          await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
            networkId,
            tokenAddress,
            chartType: wsChartType,
            currency,
          });
        } catch (error) {
          console.error('Failed to unsubscribe from market data:', error);
        }
      }

      void cleanup();
    };
  }, [networkId, tokenAddress, enabled, wsChartType, currency]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleMarketDataUpdate(payload: IMarketPriceUpdatePayload): void {
      if (
        payload.tokenAddress !== tokenAddress ||
        payload.channel !== 'ohlcv'
      ) {
        return;
      }

      markSubscriptionActivity();

      const now = Math.floor(Date.now() / 1000);
      if (now - lastUpdateTime.current < 4) {
        return;
      }

      const webView = webRef.current;
      if (!webView) {
        return;
      }

      const receivedData = payload.data as IWsPriceData;
      if (
        receivedData &&
        !('points' in receivedData) &&
        receivedData.type &&
        normalizeMarketWsKLineInterval(receivedData.type) !== wsChartType
      ) {
        return;
      }

      const rawDataForWebView =
        receivedData && 'points' in receivedData
          ? receivedData
          : {
              points: [
                {
                  ...receivedData,

                  // oxlint-disable-next-line @cspell/spellchecker
                  t: receivedData.unixTime,
                },
              ],
              total: 1,
            };

      // Q2 FIX: same numeric-OHLCV normalization as the history path, so realtime
      // updates carry valid o/h/l/c/v (the WS tick / API bar may be close-only or
      // stringy). Safe pass-through when already full numeric OHLCV.
      const { data: dataForWebView } = normalizeKLineForPage(
        rawDataForWebView as unknown as IMarketTokenKLineResponse,
      );

      webView.sendMessageViaInjectedScript({
        type: 'autoKLineUpdate',
        payload: {
          type: 'realtime',
          kLineData: dataForWebView,
          timestamp: now,
        },
      });

      void backgroundApiProxy.serviceMarketWS.clearDataCount({
        address: tokenAddress,
        type: 'ohlcv',
      });

      lastUpdateTime.current = now;
    }

    appEventBus.on(
      EAppEventBusNames.MarketWSDataUpdate,
      handleMarketDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWSDataUpdate,
        handleMarketDataUpdate,
      );
    };
  }, [
    markSubscriptionActivity,
    networkId,
    tokenAddress,
    webRef,
    enabled,
    wsChartType,
  ]);
}
