import { memo } from 'react';

import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
}

export const MarketTradingView = memo(
  ({
    tokenAddress,
    networkId,
    tokenSymbol = '',
    decimal = 8,
  }: IMarketTradingViewProps) => {
    return (
      <TradingViewV2
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
      />
    );
  },
  (prevProps, nextProps) => prevProps.tokenSymbol === nextProps.tokenSymbol,
);

MarketTradingView.displayName = 'MarketTradingView';
