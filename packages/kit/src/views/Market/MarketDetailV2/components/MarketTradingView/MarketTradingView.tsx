import { memo } from 'react';

import { TradingViewV2 } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';

import { useTokenDetail } from '../../hooks/useTokenDetail';

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
    const { websocketConfig } = useTokenDetail();
    const dataSource = websocketConfig?.kline ? 'websocket' : 'polling';

    return (
      <TradingViewV2
        symbol={tokenSymbol}
        tokenAddress={tokenAddress}
        networkId={networkId}
        decimal={decimal}
        dataSource={dataSource}
      />
    );
  },
  (prevProps, nextProps) => prevProps.tokenSymbol === nextProps.tokenSymbol,
);

MarketTradingView.displayName = 'MarketTradingView';
