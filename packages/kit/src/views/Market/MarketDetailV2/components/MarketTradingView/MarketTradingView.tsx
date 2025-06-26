import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  identifier?: string;
}

export function MarketTradingView({
  tokenAddress,
  networkId,
  tokenSymbol = '',
  identifier = 'OneKey',
}: IMarketTradingViewProps) {
  return (
    <TradingView
      version="v2"
      mode="realtime"
      identifier={identifier}
      baseToken={tokenSymbol}
      targetToken="USDT"
      tokenAddress={tokenAddress}
      networkId={networkId}
      onLoadEnd={() => {}}
    />
  );
}
