import { type RefObject, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IWebViewRef } from '../../../WebView/types';

interface IUseTradingViewV2WebSocketProps {
  networkId: string;
  tokenAddress: string;
  webRef: RefObject<IWebViewRef | null>;
}

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
}: IUseTradingViewV2WebSocketProps) {
  // Initialize and manage WebSocket connection
  useEffect(() => {
    const initWebSocket = async () => {
      try {
        const instanceId =
          await backgroundApiProxy.serviceSetting.getInstanceId();

        await backgroundApiProxy.serviceMarketWS.connect(instanceId);

        // Subscribe to OHLCV data for the specified token and network
        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV({
          networkId,
          tokenAddress,
        });
      } catch (error) {
        console.error('Failed to initialize market WebSocket:', error);
      }
    };

    void initWebSocket();

    return () => {
      void backgroundApiProxy.serviceMarketWS.disconnect();
    };
  }, [networkId, tokenAddress]);

  // Listen for market data updates via the app event bus
  useEffect(() => {
    const handleMarketDataUpdate = (payload: {
      channel: string;
      networkId: string;
      tokenAddress: string;
      data: any;
    }) => {
      if (
        payload.networkId === networkId &&
        payload.tokenAddress === tokenAddress
      ) {
        if (payload.channel === 'ohlcv') {
          if (webRef.current) {
            webRef.current.sendMessageViaInjectedScript({
              type: 'tradingview-ohlcv',
              payload: { ohlcvData: payload.data },
            });
          }
        } else if (payload.channel === 'tokenTxs') {
          if (webRef.current) {
            webRef.current.sendMessageViaInjectedScript({
              type: 'tradingview-realtime',
              payload: { marketData: payload.data },
            });
          }
        }
      }
    };

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
  }, [networkId, tokenAddress, webRef]);
}
