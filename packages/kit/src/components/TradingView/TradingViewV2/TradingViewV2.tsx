import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useCurrency } from '../../Currency';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import {
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useTradingViewV2WebSocket,
} from './hooks';
import {
  fetchAndSendAccountMarks,
  useTradingViewMessageHandler,
} from './messageHandlers';

import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

interface IBaseTradingViewV2Props {
  symbol: string;
  tokenAddress?: string;
  networkId?: string;
  decimal: number;
  onPanesCountChange?: (count: number) => void;
  dataSource?: 'websocket' | 'polling';
  accountAddress?: string;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const webRef = useRef<IWebViewRef | null>(null);
  const theme = useThemeVariant();
  const isVisible = useRouteIsFocused();
  const currencyInfo = useCurrency();

  const {
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    onPanesCountChange,
    dataSource,
    accountAddress,
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
    accountAddress,
    tokenSymbol: symbol,
  });

  const { finalUrl: tradingViewUrlWithParams } = useTradingViewUrl({
    additionalParams: {
      symbol,
      decimal: decimal?.toString(),
      networkId,
      address: tokenAddress,
    },
  });

  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible && dataSource !== 'websocket',
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
    enabled: isVisible && dataSource === 'websocket',
    chartType: '1m',
    currency: currencyInfo.id,
  });

  // Load marks on page enter and refresh when swap transaction succeeds
  useEffect(() => {
    if (!isVisible || !accountAddress || !tokenAddress || !networkId) return;

    const refreshMarks = () => {
      const now = Math.floor(Date.now() / 1000);
      void fetchAndSendAccountMarks({
        accountAddress,
        tokenAddress,
        networkId,
        from: now - 86_400,
        to: now,
        webRef,
      });
    };

    // Load marks when page becomes visible
    refreshMarks();

    const handleSwapSuccess = (payload: {
      status: ESwapTxHistoryStatus;
      fromToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
      toToken?: {
        networkId: string;
        contractAddress?: string;
        address?: string;
      };
    }) => {
      if (
        payload.status !== ESwapTxHistoryStatus.SUCCESS &&
        payload.status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }

      // Check if current token matches fromToken or toToken
      const fromAddr =
        payload.fromToken?.contractAddress || payload.fromToken?.address;
      const toAddr =
        payload.toToken?.contractAddress || payload.toToken?.address;
      const isMatch =
        (payload.fromToken?.networkId === networkId &&
          fromAddr === tokenAddress) ||
        (payload.toToken?.networkId === networkId && toAddr === tokenAddress);

      if (!isMatch) return;

      refreshMarks();
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapSuccess,
      );
    };
  }, [isVisible, accountAddress, tokenAddress, networkId, webRef]);

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  const webView = useMemo(
    () => (
      <WebView
        key={theme}
        customReceiveHandler={async (data) => {
          await customReceiveHandler(data as ICustomReceiveHandlerData);
        }}
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
    ),
    [
      customReceiveHandler,
      onShouldStartLoadWithRequest,
      theme,
      tradingViewUrlWithParams,
      webRef,
    ],
  );

  return (
    <Stack position="relative" flex={1}>
      {webView}

      {platformEnv.isNativeIOS ? (
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
};
