import { useCallback, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import { TRADING_VIEW_URL } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../WebView';

import { useAutoKLineUpdate } from './useAutoKLineUpdate';
import { fetchTradingViewV2DataWithSlicing } from './useTradingViewV2';

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

  const {
    mode,
    onLoadEnd,
    tradingViewUrl = TRADING_VIEW_URL,
    tokenAddress = '',
    networkId = '',
  } = props;

  const customReceiveHandler = useCallback(
    async ({ data }: ICustomReceiveHandlerData) => {
      console.log('customReceiveHandler', data);
      // {
      //     "scope": "$private",
      //     "method": "tradingview_getKLineData",
      //     "origin": "tradingview.onekey.so",
      //     "data": {
      //         "method": "tradingview_getHistoryData",
      //         "resolution": "1D",
      //         "from": 1724803200,
      //         "to": 1750809600,
      //         "firstDataRequest": true
      //     }
      // }

      // Handle TradingView private API requests
      if (
        data.scope === '$private' &&
        data.method === 'tradingview_getKLineData'
      ) {
        console.log('TradingView request received:', {
          method: data.data.method,
          resolution: data.data.resolution,
          from: data.data.from,
          to: data.data.to,
          firstDataRequest: data.data.firstDataRequest,
          origin: data.origin,
        });

        // Use combined function to get sliced data
        try {
          const kLineData = await fetchTradingViewV2DataWithSlicing({
            tokenAddress,
            networkId,
            interval: data.data.resolution,
            timeFrom: data.data.from,
            timeTo: data.data.to,
          });

          if (webRef.current && kLineData) {
            webRef.current.sendMessageViaInjectedScript({
              type: 'kLineData',
              payload: {
                type: 'history',
                kLineData,
                requestData: data.data,
              },
            });
          }
        } catch (error) {
          console.error('Failed to fetch and send kline data:', error);
        }
      }
    },
    [tokenAddress, networkId],
  );

  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: mode === 'realtime',
  });

  return (
    <Stack position="relative" flex={1}>
      <WebView
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
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
