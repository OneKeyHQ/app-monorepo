import { memo, useCallback, useRef } from 'react';

import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type { ITradingViewPriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';
import { buildMatchedRealtimeTokenDetail } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/priceUtils';

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
    const [tokenDetail] = useTokenDetailAtom();
    const tokenDetailActions = useTokenDetailActions();
    const tokenDetailRef = useRef(tokenDetail);
    tokenDetailRef.current = tokenDetail;

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
        const realtimePrice = normalizeChartRealtimePrice(data.price);
        if (!realtimePrice) {
          return;
        }

        const latestTokenDetail = buildMatchedRealtimeTokenDetail({
          tokenDetail: tokenDetailRef.current,
          tokenAddress,
          networkId,
          realtimePrice,
          realtimePriceSource: MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.chart,
          lastUpdated: normalizeChartUpdateTimestamp(data.timestamp),
        });

        if (latestTokenDetail) {
          tokenDetailActions.current.setTokenDetail(latestTokenDetail);
        }
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
