import { memo, useCallback, useEffect } from 'react';

import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  debugMarketTradingViewLog,
  shortMarketId,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/debugLog';
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

    useEffect(() => {
      debugMarketTradingViewLog('market-wrapper-props', {
        networkId,
        tokenAddress: shortMarketId(tokenAddress),
        tokenSymbol,
        dataSource,
        pageWidth,
      });
    }, [dataSource, networkId, pageWidth, tokenAddress, tokenSymbol]);

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
        const realtimePrice = normalizeChartRealtimePrice(data.price);
        if (!realtimePrice) {
          debugMarketTradingViewLog('price-update-skip-invalid', {
            source: data.source,
            symbol: data.symbol,
            priceType: typeof data.price,
          });
          return;
        }

        debugMarketTradingViewLog('price-update-apply', {
          source: data.source,
          symbol: data.symbol,
          tokenAddress: shortMarketId(tokenAddress),
          networkId,
          price: realtimePrice,
          timestamp: data.timestamp,
        });

        tokenDetailActions.current.applyChartPriceUpdate({
          tokenAddress,
          networkId,
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
        onPriceUpdate={handlePriceUpdate}
      />
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
