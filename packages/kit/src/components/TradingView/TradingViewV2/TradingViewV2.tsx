import { useCallback, useEffect, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';

import { useTradingViewV2 } from './useTradingViewV2';
// import { useTradingViewV2WebSocket } from './useTradingViewV2WebSocket';

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

  // Calculate the current timestamp in seconds once per render.
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const {
    onLoadEnd,
    tradingViewUrl = 'http://localhost:5173/?mode=dev',
    tokenAddress = '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    networkId = 'sol--101',
    interval = '1D',
    // Default to a one-year window: from now minus one year to now.
    timeFrom = 1,
    timeTo = nowInSeconds,
  } = props;

  const { kineData } = useTradingViewV2({
    tokenAddress,
    networkId,
    interval,
    timeFrom,
    timeTo,
  });

  console.log('kineData', kineData);

  // Periodically send fetched K-line data to the WebView
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (webRef.current) {
        webRef.current.sendMessageViaInjectedScript({
          type: 'tradingview',
          payload: {
            kineData, // Pass K-line data to WebView
          },
        });
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [kineData]);

  // Handle WebSocket connection and real-time data forwarding
  // useTradingViewV2WebSocket({ networkId, tokenAddress, webRef });

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
