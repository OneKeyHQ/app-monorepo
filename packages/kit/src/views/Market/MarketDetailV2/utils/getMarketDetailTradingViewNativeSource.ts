import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

export function getMarketDetailTradingViewNativeSource({
  hyperliquidCoin,
  marketDataSource,
  networkId,
  symbol,
  tokenAddress,
}: {
  hyperliquidCoin: string;
  marketDataSource: 'polling' | 'websocket' | undefined;
  networkId: string;
  symbol: string;
  tokenAddress: string;
}): ITradingViewNativeSource {
  if (hyperliquidCoin) {
    return {
      kind: 'hyperliquid',
      coin: hyperliquidCoin,
      environment: 'mainnet',
    };
  }

  return {
    kind: 'market',
    networkId,
    tokenAddress,
    symbol,
    realtime: marketDataSource === 'websocket' ? 'websocket' : 'disabled',
  };
}
