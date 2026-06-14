import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SizableText, Stack, useTheme } from '@onekeyhq/components';
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
  normalizeTradingViewKLineInterval,
  useTradingViewMessageHandler,
} from './messageHandlers';

import type { ITradingViewV2KLineDataFallback } from './hooks/useTradingViewV2';
import type { IMarksTimeRange } from './messageHandlers';
import type {
  ICustomReceiveHandlerData,
  ITradingViewPriceUpdateData,
} from './types';
import type { IWebViewRef } from '../../WebView/types';
import type { ITradingViewDisabledFeature } from '../hooks';
import type { WebViewProps } from 'react-native-webview';
import type {
  WebViewNavigation,
  WebViewNavigationEvent,
} from 'react-native-webview/lib/WebViewTypes';

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
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
  disabledFeatures?: readonly ITradingViewDisabledFeature[];
  storageNamespace?: string;
  forceEmptyKLineData?: boolean;
  emptyKLineDataOnError?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  onPrimaryKLineDataUnavailable?: () => void;
  onPriceUpdate?: (data: ITradingViewPriceUpdateData) => void;
}

export type ITradingViewV2Props = IBaseTradingViewV2Props & IStackStyle;

export const TradingViewV2 = (props: ITradingViewV2Props & WebViewProps) => {
  const webRef = useRef<IWebViewRef | null>(null);
  const marksTimeRange = useRef<IMarksTimeRange | null>(null);
  const currentKLineResolution = useRef(DEFAULT_TRADING_VIEW_KLINE_RESOLUTION);
  const [activeKLineResolution, setActiveKLineResolution] = useState(
    DEFAULT_TRADING_VIEW_KLINE_RESOLUTION,
  );
  const theme = useThemeVariant();
  const themeColors = useTheme();
  const tradingViewBackgroundColor = themeColors.bgApp.val;
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
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    disabledFeatures,
    storageNamespace,
    forceEmptyKLineData,
    emptyKLineDataOnError,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    onPrimaryKLineDataUnavailable,
    onPriceUpdate,
    onLoadStart,
    ...stackStyle
  } = props;

  const { handleNavigation } = useNavigationHandler();
  const handleCurrentKLineResolutionChange = useCallback(
    (resolution: string) => {
      const normalizedResolution =
        normalizeTradingViewKLineInterval(resolution);
      currentKLineResolution.current = normalizedResolution;
      setActiveKLineResolution((prev) =>
        prev === normalizedResolution ? prev : normalizedResolution,
      );
    },
    [],
  );
  const { customReceiveHandler } = useTradingViewMessageHandler({
    tokenAddress,
    networkId,
    webRef,
    onPanesCountChange,
    accountAddress,
    tokenSymbol: symbol,
    marksTimeRange,
    currentKLineResolution,
    onCurrentKLineResolutionChange: handleCurrentKLineResolutionChange,
    onTouchScroll,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    forceEmptyKLineData,
    emptyKLineDataOnError,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    onPrimaryKLineDataUnavailable,
    onPriceUpdate,
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
    const finalStorageNamespace =
      storageNamespace?.trim() ||
      (useHyperLiquid ? 'market-hyperliquid' : 'market');

    return {
      decimal: decimal?.toString(),
      networkId,
      address: tokenAddress,
      symbol: chartSymbol,
      type: 'market',
      storageNamespace: finalStorageNamespace,
      ...(useHyperLiquid ? { scene: 'market-hyperliquid' } : {}),
    };
  }, [
    chartSymbol,
    decimal,
    networkId,
    storageNamespace,
    tokenAddress,
    useHyperLiquid,
  ]);

  const { finalUrl: tradingViewUrlWithParams } = useTradingViewUrl({
    additionalParams,
    disabledFeatures,
  });
  const tradingViewWebViewStyleProps = useMemo(
    () => ({
      containerStyle: { backgroundColor: tradingViewBackgroundColor },
      style: { backgroundColor: tradingViewBackgroundColor },
    }),
    [tradingViewBackgroundColor],
  );

  // OneKey realtime hooks only apply to app-served market candles.
  useAutoKLineUpdate({
    tokenAddress,
    networkId,
    webRef,
    enabled:
      isVisible &&
      effectiveDataSource !== 'websocket' &&
      !isHyperLiquidSource &&
      !mockEmptyKLineEnabled &&
      !forceEmptyKLineData &&
      !primaryKLineDataUnavailable,
    autoHandleError: emptyKLineDataOnError ? false : undefined,
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
      !mockEmptyKLineEnabled &&
      !forceEmptyKLineData,
    chartType: activeKLineResolution,
  });

  // Load marks on page enter and refresh when swap transaction succeeds
  useEffect(() => {
    if (!isVisible || !accountAddress || !tokenAddress || !networkId) return;
    if (forceEmptyKLineData) return;

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
    forceEmptyKLineData,
    webRef,
  ]);

  const onShouldStartLoadWithRequest = useCallback(
    (event: WebViewNavigation) => handleNavigation(event),
    [handleNavigation],
  );

  const resetIndicatorsDialogOpen = useCallback(() => {
    onIndicatorsDialogOpenChange?.(false);
  }, [onIndicatorsDialogOpenChange]);

  const resetInteractionOverlayOpen = useCallback(() => {
    onInteractionOverlayOpenChange?.(false);
  }, [onInteractionOverlayOpenChange]);

  const resetInteractionLocks = useCallback(() => {
    resetIndicatorsDialogOpen();
    resetInteractionOverlayOpen();
  }, [resetIndicatorsDialogOpen, resetInteractionOverlayOpen]);

  const handleLoadStart = useCallback(
    (event: WebViewNavigationEvent) => {
      resetInteractionLocks();
      onLoadStart?.(event);
    },
    [onLoadStart, resetInteractionLocks],
  );

  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      if (!ref) {
        resetInteractionLocks();
      }
      webRef.current = ref;
    },
    [resetInteractionLocks, webRef],
  );

  useEffect(() => {
    return () => {
      resetInteractionLocks();
    };
  }, [resetInteractionLocks]);

  const handleMockEmptyKLineBadgePress = useCallback(() => {
    setMockEmptyKLineBadgePositionIndex(
      (positionIndex) =>
        (positionIndex + 1) % MOCK_EMPTY_KLINE_BADGE_POSITION_STYLES.length,
    );
  }, []);

  const webView = useMemo(
    () => (
      <WebView
        key={`${theme}:${tradingViewUrlWithParams}`}
        containerProps={{ bg: '$bgApp' }}
        containerStyle={tradingViewWebViewStyleProps.containerStyle}
        style={tradingViewWebViewStyleProps.style}
        customReceiveHandler={async (data) => {
          const receiveData = data as ICustomReceiveHandlerData;
          await customReceiveHandler(receiveData);
        }}
        onWebViewRef={handleWebViewRef}
        allowsBackForwardNavigationGestures={false}
        onLoadStart={handleLoadStart}
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
      handleLoadStart,
      handleWebViewRef,
      onShouldStartLoadWithRequest,
      theme,
      tradingViewUrlWithParams,
      tradingViewWebViewStyleProps,
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
