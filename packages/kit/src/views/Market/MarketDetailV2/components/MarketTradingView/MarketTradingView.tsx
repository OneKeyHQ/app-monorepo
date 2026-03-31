import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';

import { MarketTestIDs } from '../../../testIDs';
import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

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
  }: IMarketTradingViewProps) => {
    const { accountAddress } = useNetworkAccountAddress(networkId);

    return (
      <Stack testID={MarketTestIDs.detailChart} flex={1}>
        <TradingViewV2
          symbol={tokenSymbol}
          tokenAddress={tokenAddress}
          networkId={networkId}
          decimal={decimal}
          dataSource={dataSource}
          accountAddress={accountAddress}
          w={pageWidth}
          onTouchScroll={onTouchScroll}
        />
      </Stack>
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
