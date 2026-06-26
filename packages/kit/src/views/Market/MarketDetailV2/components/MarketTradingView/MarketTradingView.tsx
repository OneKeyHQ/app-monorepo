import { memo, useCallback } from 'react';

import {
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type {
  ITradingViewDisabledFeature,
  ITradingViewPriceUpdateData,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketTestIDs } from '../../../testIDs';
import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

const ENABLE_NATIVE_MARKET_CHART_CONTROLS = platformEnv.isNative;
const MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES: readonly ITradingViewDisabledFeature[] =
  [
    TRADING_VIEW_DISABLED_FEATURES.TIMEFRAME_SELECTOR,
    TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE,
    TRADING_VIEW_DISABLED_FEATURES.SETTINGS,
    TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN,
    TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
    TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
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

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
  dataSource: 'websocket' | 'polling';
  pageWidth?: number;
  onTouchScroll?: (deltaY: number) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}

export const MarketTradingView = memo(
  ({
    tokenAddress,
    networkId,
    tokenSymbol = '',
    decimal = 8,
    dataSource,
    pageWidth,
    onTouchScroll,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
  }: IMarketTradingViewProps) => {
    const { accountAddress } = useNetworkAccountAddress(networkId);
    const tokenDetailActions = useTokenDetailActions();

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
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
      [networkId, tokenAddress, tokenDetailActions],
    );

    return (
      <TradingViewV2
        testID={MarketTestIDs.detailChart}
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
        dataSource={dataSource}
        accountAddress={accountAddress}
        w={pageWidth}
        onTouchScroll={onTouchScroll}
        onIndicatorsDialogOpenChange={onIndicatorsDialogOpenChange}
        onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
        onPriceUpdate={handlePriceUpdate}
        disabledFeatures={
          ENABLE_NATIVE_MARKET_CHART_CONTROLS
            ? MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES
            : undefined
        }
        enableNativeChartControls={ENABLE_NATIVE_MARKET_CHART_CONTROLS}
      />
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
