import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';
import { buildMatchedRealtimeTokenDetail } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/priceUtils';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IWebViewRef } from '../../../WebView/types';

const TRADING_VIEW_WS_BRIDGE_THROTTLE_SECONDS = 4;

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

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
  enabled = true,
  chartType = '1m',
  currency = 'usd',
}: IUseTradingViewV2WebSocketProps): void {
  const lastBridgeUpdateTime = useRef<number>(0);
  const tokenDetailActions = useTokenDetailActions();
  const [tokenDetail] = useTokenDetailAtom();
  const tokenDetailRef = useRef(tokenDetail);
  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled,
    networkId,
    tokenAddress,
    chartType,
    currency,
    channel: 'ohlcv',
  });
  tokenDetailRef.current = tokenDetail;
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
          chartType,
          currency,
        });
      } catch (error) {
        console.error('Failed to initialize market WebSocket:', error);
      }
    }

    if (enabled) {
      void initWebSocket();
    }

    return () => {
      async function cleanup(): Promise<void> {
        try {
          await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
            networkId,
            tokenAddress,
            chartType,
            currency,
          });
        } catch (error) {
          console.error('Failed to unsubscribe from market data:', error);
        }
      }

      void cleanup();
    };
  }, [networkId, tokenAddress, enabled, chartType, currency]);

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

      const nowMs = Date.now();
      const now = Math.floor(nowMs / 1000);
      const receivedData = payload.data as IWsPriceData;

      const webView = webRef.current;
      if (
        webView &&
        receivedData &&
        now - lastBridgeUpdateTime.current >=
          TRADING_VIEW_WS_BRIDGE_THROTTLE_SECONDS
      ) {
        const dataForWebView =
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

        lastBridgeUpdateTime.current = now;
      }

      if (receivedData && typeof receivedData.c === 'number') {
        const latestPrice = receivedData.c.toString();
        const latestTokenDetail = buildMatchedRealtimeTokenDetail({
          tokenDetail: tokenDetailRef.current,
          tokenAddress,
          networkId,
          realtimePrice: latestPrice,
          realtimePriceSource:
            MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.marketWs,
          lastUpdated: nowMs,
        });

        if (latestTokenDetail) {
          tokenDetailActions.current.setTokenDetail(latestTokenDetail);
        }
      }
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
    tokenDetailActions,
  ]);
}
