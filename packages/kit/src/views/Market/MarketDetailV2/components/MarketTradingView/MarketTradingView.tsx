import { memo, useCallback, useEffect, useMemo } from 'react';

import {
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type {
  ITradingViewDisabledFeature,
  ITradingViewKLineDataReadyData,
  ITradingViewKLinePeriodChangeData,
  ITradingViewNativeIndicatorQuickBarState,
  ITradingViewPriceUpdateData,
  ITradingViewV2KLineDataFallback,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketTestIDs } from '../../../testIDs';
import {
  getMarketTradingViewSessionPreference,
  hydrateMarketTradingViewPreferences,
  saveMarketTradingViewFirstScreenRequestPreference,
  saveMarketTradingViewResolutionPreference,
  updateMarketTradingViewSessionResolution,
} from '../../utils/marketTradingViewResolutionPreference';
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

function normalizeChartRealtimePrice(
  price: ITradingViewPriceUpdateData['price'],
) {
  const priceString =
    typeof price === 'number' ? price.toString() : price?.trim();
  const numericPrice = Number(priceString);
  return Number.isFinite(numericPrice) && numericPrice > 0
    ? priceString
    : undefined;
}

function normalizeChartUpdateTimestamp(
  timestamp: ITradingViewPriceUpdateData['timestamp'],
) {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return Date.now();
  }

  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
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
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  marketPrice?: string | number;
  historyStartTime?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
  dataSource: 'websocket' | 'polling';
  storageNamespace?: string;
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
    marketPrice,
    historyStartTime,
    dataSource,
    storageNamespace,
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
    const initialKLineResolutions = useMemo(
      () => ({
        market: getMarketTradingViewSessionPreference({
          tokenAddress,
          networkId,
          namespace: 'market',
        }).resolution,
        marketHyperLiquid: getMarketTradingViewSessionPreference({
          tokenAddress,
          networkId,
          namespace: 'market-hyperliquid',
        }).resolution,
      }),
      [networkId, tokenAddress],
    );

    useEffect(() => {
      void hydrateMarketTradingViewPreferences();
    }, []);

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
        if (disableChartPriceUpdate) {
          return;
        }
        if (data.source === 'history') {
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

        const realtimePrice = normalizeChartRealtimePrice(data.price);
        if (!realtimePrice) {
          return;
        }

        tokenDetailActions.current.applyChartPriceUpdate({
          tokenAddress: data.tokenAddress,
          networkId: data.networkId,
          price: realtimePrice,
          lastUpdated: normalizeChartUpdateTimestamp(data.timestamp),
        });
      },
      [disableChartPriceUpdate, networkId, tokenAddress, tokenDetailActions],
    );
    const handleKLineDataReady = useCallback(
      (data: ITradingViewKLineDataReadyData) => {
        if (data.requestRange) {
          void saveMarketTradingViewFirstScreenRequestPreference({
            resolution: data.period,
            ...data.requestRange,
            namespace:
              data.storageNamespace === 'market-hyperliquid'
                ? 'market-hyperliquid'
                : 'market',
          });
        }
      },
      [],
    );
    const handleKLinePeriodChange = useCallback(
      (data: ITradingViewKLinePeriodChangeData) => {
        const namespace =
          data.storageNamespace === 'market-hyperliquid'
            ? 'market-hyperliquid'
            : 'market';
        void saveMarketTradingViewResolutionPreference(
          data.toPeriod,
          namespace,
        );
        updateMarketTradingViewSessionResolution({
          tokenAddress,
          networkId,
          resolution: data.toPeriod,
          namespace,
        });
      },
      [networkId, tokenAddress],
    );

    return (
      <TradingViewV2
        testID={MarketTestIDs.detailChart}
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
        marketPrice={marketPrice}
        historyStartTime={historyStartTime}
        initialKLineResolution={initialKLineResolutions.market}
        initialHyperLiquidKLineResolution={
          initialKLineResolutions.marketHyperLiquid
        }
        dataSource={dataSource}
        storageNamespace={storageNamespace}
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
        onKLineDataReady={handleKLineDataReady}
        onKLinePeriodChange={handleKLinePeriodChange}
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
            <MarketChartFullscreenHeader chartMode="tradingView" />
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
