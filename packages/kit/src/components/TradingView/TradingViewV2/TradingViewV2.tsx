import { useCallback, useRef } from 'react';

import { Stack, useOrientation } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useTradingViewUrl } from '../hooks';

import {
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useNavigationHandler,
  useTradingViewV2WebSocket,
} from './hooks';
import { useTradingViewMessageHandler } from './messageHandlers';

import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewV2Props {
  identifier: string;
  symbol: string;
  targetToken: string;
  onLoadEnd: () => void;
  tradingViewUrl?: string;
  tokenAddress?: string;
  networkId?: string;
  interval?: string;
  timeFrom?: number;
  timeTo?: number;
  decimal: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export function TradingViewV2(props: ITradingViewV2Props & WebViewProps) {
  const isLandscape = useOrientation();
  const isIPadPortrait = platformEnv.isNativeIOSPad && !isLandscape;
  const webRef = useRef<IWebViewRef | null>(null);
  const theme = useThemeVariant();
  const isVisible = useRouteIsFocused();

  const {
    onLoadEnd,
    tradingViewUrl,
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    onPanesCountChange,
    isNative = false,
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
  });

  const { finalUrl: tradingViewUrlWithParams } = useTradingViewUrl({
    tradingViewUrl,
    additionalParams: {
      symbol,
      decimal: decimal?.toString(),
      networkId,
      address: tokenAddress,
    },
  });

  // Use different data update strategies based on token type
  // For native tokens (main coins), use traditional K-line updates
  // For other tokens, use WebSocket for better real-time data
  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && isNative,
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible,
  });

  // Enhanced WebSocket connection for real-time market data
  useTradingViewV2WebSocket({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && !isNative,
    chartType: '1m',
    currency: 'usd',
  });

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  return (
    <Stack position="relative" flex={1}>
      <WebView
        key={theme}
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
        onLoadEnd={onLoadEnd}
        onWebViewRef={(ref) => {
          webRef.current = ref;
        }}
        allowsBackForwardNavigationGestures={false}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        displayProgressBar={false}
        pullToRefreshEnabled={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        src={tradingViewUrlWithParams}
      />

      {platformEnv.isNativeIOS || isIPadPortrait ? (
        <Stack
          position="absolute"
          left={0}
          top={50}
          bottom={0}
          width={15}
          zIndex={1}
          pointerEvents="auto"
        />
      ) : null}
    </Stack>
  );
}
