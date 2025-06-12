import { useCallback, useEffect, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';

import { useTradingViewV2 } from './useTradingViewV2';

import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';

interface IBaseTradingViewV2Props {
  mode: 'overview' | 'realtime';
  identifier: string;
  baseToken: string;
  targetToken: string;
  onLoadEnd: () => void;
  tradingViewUrl?: string;
  tokenAddress?: string;
  networkId?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export function TradingViewV2(props: ITradingViewV2Props & WebViewProps) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);

  const {
    onLoadEnd,
    tradingViewUrl = 'http://localhost:5173/',
    tokenAddress = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    networkId = 'sol--101',
    interval = '1D',
    timeFrom = 1_723_593_600,
    timeTo = 1_749_513_600,
  } = props;

  const { kineData } = useTradingViewV2({
    tokenAddress,
    networkId,
    interval,
    timeFrom,
    timeTo,
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (webRef.current) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'tradingview',
          payload: {
            kineData, // Pass kine data to WebView
          },
        });
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [kineData]);

  // WebSocket integration for real-time market data
  useEffect(() => {
    const initWebSocket = async () => {
      try {
        const instanceId =
          await backgroundApiProxy.serviceSetting.getInstanceId();

        console.log('instanceId', instanceId);
        await backgroundApiProxy.serviceMarketWS.connect(instanceId);

        // await backgroundApiProxy.serviceMarketWS.subscribeTokenTxs({
        //   networkId,
        //   tokenAddress,
        // });

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
      // void backgroundApiProxy.serviceMarketWS.unsubscribe({
      //   channel: 'tokenTxs',
      //   networkId,
      //   tokenAddress,
      // });
      // void backgroundApiProxy.serviceMarketWS.unsubscribe({
      //   channel: 'ohlcv',
      //   networkId,
      //   tokenAddress,
      // });
      void backgroundApiProxy.serviceMarketWS.disconnect();
    };
  }, [networkId, tokenAddress]);

  // Listen for market data events
  useEffect(() => {
    const handleMarketDataUpdate = (payload: {
      channel: string;
      networkId: string;
      tokenAddress: string;
      data: any;
    }) => {
      // Only handle events for our specific token and network
      if (
        payload.networkId === networkId &&
        payload.tokenAddress === tokenAddress
      ) {
        if (payload.channel === 'ohlcv') {
          console.log('ohlcvData', payload.data);

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
  }, [networkId, tokenAddress]);

  const customReceiveHandler = useCallback((...args: any[]) => {
    console.log('customReceiveHandler', args);
  }, []);

  return (
    <Stack position="relative" flex={1}>
      <WebView
        customReceiveHandler={customReceiveHandler}
        onLoadEnd={onLoadEnd}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        displayProgressBar={false}
        src={tradingViewUrl}
      />

      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={isIPadPortrait ? 50 : 40}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
