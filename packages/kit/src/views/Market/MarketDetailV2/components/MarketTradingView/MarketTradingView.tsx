import { memo, useCallback, useEffect, useRef } from 'react';

import type { ITradingViewNativeIntervalStorageNamespace } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';
import {
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type {
  ITradingViewDisabledFeature,
  ITradingViewNativeIndicatorQuickBarState,
  ITradingViewPriceUpdateData,
  ITradingViewV2KLineDataFallback,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketTestIDs } from '../../../testIDs';
import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

import { MarketChartFullscreenHeader } from './MarketChartFullscreenHeader';

const MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES: readonly ITradingViewDisabledFeature[] =
  [
    TRADING_VIEW_DISABLED_FEATURES.TIMEFRAME_SELECTOR,
    TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE,
    TRADING_VIEW_DISABLED_FEATURES.SETTINGS,
    TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN,
    TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
    TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
  ];

const STOCK_MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES: readonly ITradingViewDisabledFeature[] =
  [
    ...MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES,
    TRADING_VIEW_DISABLED_FEATURES.CHART_TYPE,
  ];

function normalizeChartPrice(price: ITradingViewPriceUpdateData['price']) {
  const priceString =
    typeof price === 'number' ? price.toString() : price?.trim();
  const numericPrice = Number(priceString);
  return Number.isFinite(numericPrice) && numericPrice > 0
    ? priceString
    : undefined;
}

function normalizeTokenAddress(address: string | undefined) {
  return address?.trim().toLowerCase() ?? '';
}

function isChartPriceUpdateForCurrentToken({
  data,
  tokenAddress,
  networkId,
}: {
  data: ITradingViewPriceUpdateData;
  tokenAddress: string;
  networkId: string;
}) {
  if (!data.networkId || data.networkId !== networkId) {
    return false;
  }

  const currentTokenAddress = normalizeTokenAddress(tokenAddress);
  const updateTokenAddress = normalizeTokenAddress(data.tokenAddress);

  return currentTokenAddress
    ? updateTokenAddress === currentTokenAddress
    : !updateTokenAddress;
}

export interface IMarketTradingViewProps {
  loadingIdentity?: string;
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
  dataSource: 'websocket' | 'polling';
  storageNamespace?: string;
  intervalStorageNamespace?: ITradingViewNativeIntervalStorageNamespace;
  pageWidth?: number;
  nativeChartTypeControlMode?: 'toggle' | 'select';
  nativeIndicatorControlMode?: 'dialog' | 'popover';
  nativeIntervalControlMode?: 'dialog' | 'popover';
  nativePriceMarketCapControlMode?: 'settings' | 'select';
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  isNativeChartFullscreen?: boolean;
  showNativeIndicatorQuickBar?: boolean;
  onChartSwitch?: () => void;
  onTouchScroll?: (deltaY: number) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onNativeIndicatorQuickBarChange?: (
    state: ITradingViewNativeIndicatorQuickBarState,
  ) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
  onNativeSubIndicatorCountChange?: (
    count: number | null,
    options?: { layoutRestored?: boolean },
  ) => void;
  maxSelectableSubIndicatorCount?: number;
  forceCandlestickChart?: boolean;
  kLineDataFallback?: ITradingViewV2KLineDataFallback;
  primaryKLineDataUnavailable?: boolean;
  disableChartPriceUpdate?: boolean;
  onChartError?: () => void;
  onChartReady?: () => void;
  onVisualReady?: () => void;
}

export const MarketTradingView = memo(
  ({
    tokenAddress,
    networkId,
    tokenSymbol = '',
    decimal = 8,
    dataSource,
    storageNamespace,
    intervalStorageNamespace,
    pageWidth,
    nativeChartTypeControlMode,
    nativeIndicatorControlMode,
    nativeIntervalControlMode,
    nativePriceMarketCapControlMode,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    showNativeIndicatorQuickBar,
    onChartSwitch,
    onTouchScroll,
    onNativeChartFullscreenChange,
    onNativeIndicatorQuickBarChange,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    onNativeSubIndicatorCountChange,
    maxSelectableSubIndicatorCount,
    forceCandlestickChart,
    kLineDataFallback,
    primaryKLineDataUnavailable,
    disableChartPriceUpdate,
    onChartError,
    onChartReady,
    onVisualReady,
  }: IMarketTradingViewProps) => {
    const { accountAddress } = useNetworkAccountAddress(networkId);
    const tokenDetailActions = useTokenDetailActions();
    const [tokenDetail] = useTokenDetailAtom();
    const tokenDetailRef = useRef(tokenDetail);
    tokenDetailRef.current = tokenDetail;
    const priceUpdateStateRef = useRef<
      | {
          networkId: string;
          tokenAddress: string;
          disabled?: boolean;
          hasRealtimePrice: boolean;
          lastUpdated: number;
          pendingPrice?: string;
        }
      | undefined
    >(undefined);

    if (
      !priceUpdateStateRef.current ||
      priceUpdateStateRef.current.networkId !== networkId ||
      priceUpdateStateRef.current.tokenAddress !== tokenAddress ||
      priceUpdateStateRef.current.disabled !== disableChartPriceUpdate
    ) {
      priceUpdateStateRef.current = {
        networkId,
        tokenAddress,
        disabled: disableChartPriceUpdate,
        hasRealtimePrice: false,
        lastUpdated: priceUpdateStateRef.current?.lastUpdated ?? 0,
      };
    }
    const priceUpdateState = priceUpdateStateRef.current;

    const applyChartPrice = useCallback(
      (price: string) => {
        if (
          disableChartPriceUpdate ||
          priceUpdateState !== priceUpdateStateRef.current
        ) {
          return;
        }

        const detail = tokenDetailRef.current;
        if (
          !detail ||
          !isChartPriceUpdateForCurrentToken({
            data: {
              networkId: detail.networkId ?? networkId,
              tokenAddress: detail.address,
            },
            networkId,
            tokenAddress,
          })
        ) {
          // Preview data can mount the chart before token details are ready.
          priceUpdateState.pendingPrice = price;
          return;
        }

        // The header cache requires strictly newer timestamps, including ticks
        // received in the same millisecond or carrying the same candle time.
        const detailUpdatedAt =
          typeof detail.lastUpdated === 'number' &&
          Number.isFinite(detail.lastUpdated)
            ? detail.lastUpdated
            : 0;
        priceUpdateState.lastUpdated = Math.max(
          Date.now(),
          priceUpdateState.lastUpdated + 1,
          detailUpdatedAt + 1,
        );
        priceUpdateState.pendingPrice = undefined;
        tokenDetailActions.current.applyChartPriceUpdate({
          tokenAddress,
          networkId,
          price,
          lastUpdated: priceUpdateState.lastUpdated,
        });
      },
      [
        disableChartPriceUpdate,
        networkId,
        priceUpdateState,
        tokenAddress,
        tokenDetailActions,
      ],
    );

    useEffect(() => {
      if (priceUpdateState.pendingPrice !== undefined) {
        applyChartPrice(priceUpdateState.pendingPrice);
      }
    }, [applyChartPrice, priceUpdateState, tokenDetail]);

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
        if (disableChartPriceUpdate) {
          return;
        }
        // Bootstrap from the latest history bar, but never let a delayed
        // history response replace a realtime price, even while buffering.
        if (data.source === 'history' && priceUpdateState.hasRealtimePrice) {
          return;
        }
        if (
          !isChartPriceUpdateForCurrentToken({
            data,
            tokenAddress,
            networkId,
          })
        ) {
          return;
        }

        const chartPrice = normalizeChartPrice(data.price);
        if (!chartPrice) {
          return;
        }

        if (data.source !== 'history') {
          priceUpdateState.hasRealtimePrice = true;
        }
        applyChartPrice(chartPrice);
      },
      [
        applyChartPrice,
        disableChartPriceUpdate,
        networkId,
        priceUpdateState,
        tokenAddress,
      ],
    );

    return (
      <TradingViewV2
        testID={MarketTestIDs.detailChart}
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
        dataSource={dataSource}
        storageNamespace={storageNamespace}
        intervalStorageNamespace={intervalStorageNamespace}
        accountAddress={accountAddress}
        w={pageWidth}
        onTouchScroll={onTouchScroll}
        onIndicatorsDialogOpenChange={onIndicatorsDialogOpenChange}
        onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
        onNativeSubIndicatorCountChange={onNativeSubIndicatorCountChange}
        maxSelectableSubIndicatorCount={maxSelectableSubIndicatorCount}
        onPriceUpdate={handlePriceUpdate}
        kLineDataFallback={kLineDataFallback}
        primaryKLineDataUnavailable={primaryKLineDataUnavailable}
        onChartError={onChartError}
        onChartReady={onChartReady}
        onVisualReady={onVisualReady}
        disabledFeatures={
          forceCandlestickChart
            ? STOCK_MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES
            : MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES
        }
        forceCandlestickChart={forceCandlestickChart}
        enableNativeChartControls
        enableNativeChartSettings
        nativeChartTypeControlMode={nativeChartTypeControlMode}
        nativeIndicatorControlMode={nativeIndicatorControlMode}
        nativeIntervalControlMode={nativeIntervalControlMode}
        nativePriceMarketCapControlMode={nativePriceMarketCapControlMode}
        nativeControlsLayoutMode={nativeControlsLayoutMode}
        isNativeChartFullscreen={isNativeChartFullscreen}
        onChartSwitch={onChartSwitch}
        nativeChartFullscreenHeader={
          !platformEnv.isNative && nativeControlsLayoutMode === 'desktop' ? (
            <MarketChartFullscreenHeader />
          ) : undefined
        }
        showNativeIndicatorQuickBar={showNativeIndicatorQuickBar}
        onNativeChartFullscreenChange={onNativeChartFullscreenChange}
        onNativeIndicatorQuickBarChange={onNativeIndicatorQuickBarChange}
      />
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
