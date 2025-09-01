import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  identifier?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
}

export function MarketTradingView({
  tokenAddress,
  networkId,
  tokenSymbol = '',
  identifier = 'OneKey',
  decimal = 8,
  onPanesCountChange,
}: IMarketTradingViewProps) {
  return (
    <TradingView
      version="v2"
      mode="realtime"
      identifier={identifier}
      baseToken={tokenSymbol}
      targetToken="USDT"
      symbol={tokenSymbol}
      tokenAddress={tokenAddress}
      networkId={networkId}
      decimal={decimal}
      onLoadEnd={() => {}}
      onPanesCountChange={(count) => {
        console.log('📊 MarketDetailV2 - Panels count:', count);
        onPanesCountChange?.(count);
      }}
    />
  );
}
