import { memo, useCallback } from 'react';

import {
  MARKET_HYPERLIQUID_TRADING_VIEW_STORAGE_NAMESPACE,
  MARKET_TRADING_VIEW_STORAGE_NAMESPACE,
} from '@onekeyhq/kit/src/components/TradingView/constants';
import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { useHyperLiquidKlineSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/hooks';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

import { MarketTestIDs } from '../../../testIDs';
import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

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
  }: IMarketTradingViewProps) => {
    const { accountAddress } = useNetworkAccountAddress(networkId);
    const tokenDetailActions = useTokenDetailActions();

    // Own the chart localStorage bucket here (TradingViewV2 no longer defaults
    // it): HL-backed market tokens get the isolated 'market-hyperliquid' bucket,
    // everything else 'market'. Mirrors TradingViewV2's internal hyperliquid
    // detection (same hook + config), so namespace and scene stay consistent.
    const { isHyperLiquidSource, symbol: hyperLiquidSymbol } =
      useHyperLiquidKlineSource(networkId, tokenAddress);
    const storageNamespace =
      isHyperLiquidSource && hyperLiquidSymbol
        ? MARKET_HYPERLIQUID_TRADING_VIEW_STORAGE_NAMESPACE
        : MARKET_TRADING_VIEW_STORAGE_NAMESPACE;

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
        storageNamespace={storageNamespace}
        decimal={decimal}
        dataSource={dataSource}
        accountAddress={accountAddress}
        w={pageWidth}
        onTouchScroll={onTouchScroll}
        onIndicatorsDialogOpenChange={onIndicatorsDialogOpenChange}
        onPriceUpdate={handlePriceUpdate}
      />
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
