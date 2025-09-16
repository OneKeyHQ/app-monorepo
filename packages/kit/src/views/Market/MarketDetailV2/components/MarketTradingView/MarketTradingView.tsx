import { TradingView } from '@onekeyhq/kit/src/components/TradingView';

interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  identifier?: string;
  decimal?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
}

export function MarketTradingView({
  tokenAddress,
  networkId,
  tokenSymbol = '',
  identifier = 'OneKey',
  decimal = 8,
  onPanesCountChange,
  isNative = false,
}: IMarketTradingViewProps) {
  return (
    <TradingView
      version="v2"
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
      isNative={isNative}
    />
  );
}
