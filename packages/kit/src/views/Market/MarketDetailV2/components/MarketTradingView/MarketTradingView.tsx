import { memo } from 'react';

import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';

import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
  dataSource: 'websocket' | 'polling';
}

export const MarketTradingView = memo(
  ({
    tokenAddress,
    networkId,
    tokenSymbol = '',
    decimal = 8,
    dataSource,
  }: IMarketTradingViewProps) => {
    const { accountAddress } = useNetworkAccountAddress(networkId);

    return (
      <TradingViewV2
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
        dataSource={dataSource}
        accountAddress={accountAddress}
      />
    );
  },
);

MarketTradingView.displayName = 'MarketTradingView';
