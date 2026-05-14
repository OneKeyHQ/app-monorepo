import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';
import type { IStackStyle } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { ITradingViewKLineMockEmptyInterval } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import WebView from '../../WebView';
import { useNavigationHandler, useTradingViewUrl } from '../hooks';

import {
  useAutoKLineUpdate,
  useAutoTokenDetailUpdate,
  useHyperLiquidKlineSource,
  useTradingViewV2WebSocket,
} from './hooks';
import {
  DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  fetchAndSendAccountMarks,
  useTradingViewMessageHandler,
} from './messageHandlers';

import type { IMarksTimeRange } from './messageHandlers';
import type { ICustomReceiveHandlerData } from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { WebViewProps } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

const MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES = [
  { right: '$2', bottom: '$2' },
  { left: '$2', bottom: '$2' },
  { left: '$2', top: '$2' },
  { right: '$2', top: '$2' },
] as const;

function formatMockEmptyKLineIntervals(
  intervals: ITradingViewKLineMockEmptyInterval[] | undefined,
) {
  if (!intervals?.length) {
    return '未选择周期';
  }
  return intervals.join('/');
}

interface IBaseTradingViewV2Props {
  symbol: string;
  tokenAddress?: string;
  networkId?: string;
  decimal: number;
  onPanesCountChange?: (count: number) => void;
  dataSource?: 'websocket' | 'polling';
  accountAddress?: string;
  onTouchScroll?: (deltaY: number) => void;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const webRef = useRef<IWebViewRef | null>(null);
  const marksTimeRange = useRef<IMarksTimeRange | null>(null);
  const currentKLineResolution = useRef(DEFAULT_TRADING_VIEW_KLINE_RESOLUTION);
  const theme = useThemeVariant();
  const isVisible = useRouteIsFocused();
  const [devSettings] = useDevSettingsPersistAtom();
  const [
    mockEmptyKLineBadgePositionIndex,
    setMockEmptyKLineBadgePositionIndex,
  ] = useState(0);

  const {
    tokenAddress = '',
    networkId = '',
    symbol,
    decimal,
    onPanesCountChange,
    dataSource,
    accountAddress,
    onTouchScroll,
    ...stackStyle
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
    accountAddress,
    tokenSymbol: symbol,
    marksTimeRange,
    currentKLineResolution,
    onTouchScroll,
  });

  const { isHyperLiquidSource, symbol: hyperLiquidSymbol } =
    useHyperLiquidKlineSource(networkId, tokenAddress);
  const useHyperLiquid = Boolean(isHyperLiquidSource && hyperLiquidSymbol);
  const chartSymbol = useHyperLiquid ? (hyperLiquidSymbol ?? symbol) : symbol;
  const effectiveDataSource =
    dataSource === 'websocket' && !tokenAddress ? 'polling' : dataSource;
  const mockEmptyKLineEnabled =
    devSettings.enabled &&
    devSettings.settings?.mockTradingViewKLineEmptyEnabled;
  const mockEmptyKLineIntervals =
    devSettings.settings?.mockTradingViewKLineEmptyIntervals;
  const mockEmptyKLineBadgeText = useMemo(
    () =>
      `Mock 空K线 ${formatMockEmptyKLineIntervals(mockEmptyKLineIntervals)}`,
    [mockEmptyKLineIntervals],
  );

  const additionalParams = useMemo(() => {
    return {
      decimal: decimal?.toString(),
      networkId,
      address: tokenAddress,
      symbol: chartSymbol,
      type: 'market',
      storageNamespace: useHyperLiquid ? 'market-hyperliquid' : 'market',
      ...(useHyperLiquid ? { scene: 'market-hyperliquid' } : {}),
    };
  }, [chartSymbol, decimal, networkId, tokenAddress, useHyperLiquid]);

  const { finalUrl: tradingViewUrlWithParams } = useTradingViewUrl({
    additionalParams,
  });

  // OneKey realtime hooks only apply to app-served market candles.
  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled:
      isVisible &&
      effectiveDataSource !== 'websocket' &&
      !isHyperLiquidSource &&
      !mockEmptyKLineEnabled,
  });

  useAutoTokenDetailUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled: isVisible,
  });

  useTradingViewV2WebSocket({
    tokenAddress,
    networkId,
    webRef,
    enabled:
      isVisible &&
      effectiveDataSource === 'websocket' &&
      !isHyperLiquidSource &&
      !mockEmptyKLineEnabled,
    chartType: '1m',
  });

  // Load marks on page enter and refresh when swap transaction succeeds
  useEffect(() => {
    if (!isVisible || !accountAddress || !tokenAddress || !networkId) return;

    const refreshMarks = () => {
      const now = Math.floor(Date.now() / 1000);

      // Use the tracked time range if available, otherwise default to recent period
      const timeRange = marksTimeRange.current || {
        min: now - 86_400 * 30, // Default: 30 days
        max: now,
      };

      void fetchAndSendAccountMarks({
        accountAddress,
        tokenAddress,
        networkId,
        from: timeRange.min,
        to: timeRange.max,
        symbol: chartSymbol,
        resolution: currentKLineResolution.current,
        webRef,
      });
    };

    // Reset time range when token/account changes, then load marks
    marksTimeRange.current = null;
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
  }, [
    isVisible,
    accountAddress,
    tokenAddress,
    networkId,
    chartSymbol,
    mockEmptyKLineEnabled,
    mockEmptyKLineIntervals,
    webRef,
  ]);

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  const handleMockEmptyKLineBadgePress = useCallback(() => {
    setMockEmptyKLineBadgePositionIndex(
      (positionIndex) =>
        (positionIndex + 1) % MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES.length,
    );
  }, []);

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
    <Stack position="relative" flex={1} {...stackStyle}>
      {webView}

      {mockEmptyKLineEnabled ? (
        <Stack
          position="absolute"
          zIndex={2}
          px="$2"
          py="$1"
          borderRadius="$1"
          bg="#D92D20"
          cursor="pointer"
          maxWidth={220}
          onPress={handleMockEmptyKLineBadgePress}
          {...MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES[
            mockEmptyKLineBadgePositionIndex
          ]}
        >
          <SizableText size="$bodyXsMedium" color="white" numberOfLines={2}>
            {mockEmptyKLineBadgeText}
          </SizableText>
        </Stack>
      ) : null}

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
