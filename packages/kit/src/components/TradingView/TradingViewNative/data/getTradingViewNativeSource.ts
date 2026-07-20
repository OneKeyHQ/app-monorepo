import type {
  ITradingViewNativeMarketHistorySource,
  ITradingViewNativeSource,
} from '../types';

function normalizeMarketTokenAddress(tokenAddress: string) {
  const normalizedTokenAddress = tokenAddress.trim();
  return normalizedTokenAddress.startsWith('0x')
    ? normalizedTokenAddress.toLowerCase()
    : normalizedTokenAddress;
}

function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function getTradingViewNativeSourceKey(
  source: ITradingViewNativeSource,
) {
  if (source.kind === 'hyperliquid') {
    return `hyperliquid:${source.environment}:${source.coin.trim()}`;
  }

  const marketKey = `market:${source.networkId.trim()}:${normalizeMarketTokenAddress(
    source.tokenAddress,
  )}:${normalizeMarketSymbol(source.symbol)}`;
  if (source.history?.provider === 'coinGecko') {
    return `${marketKey}:history:coinGecko:${source.history.coinGeckoId
      .trim()
      .toLowerCase()}`;
  }
  // Adding a Market fallback upgrades history capability without changing the
  // asset series, so it must not reset the chart viewport.
  return marketKey;
}

export function getTradingViewNativeSource({
  hyperliquidCoin,
  marketDataSource,
  marketHistory,
  networkId,
  symbol,
  tokenAddress,
}: {
  hyperliquidCoin: string;
  marketDataSource: 'polling' | 'websocket' | undefined;
  marketHistory?: ITradingViewNativeMarketHistorySource;
  networkId: string;
  symbol: string;
  tokenAddress: string;
}): ITradingViewNativeSource {
  const normalizedHyperliquidCoin = hyperliquidCoin.trim();
  if (normalizedHyperliquidCoin) {
    return {
      kind: 'hyperliquid',
      coin: normalizedHyperliquidCoin,
      environment: 'mainnet',
    };
  }

  return {
    kind: 'market',
    networkId,
    tokenAddress,
    symbol,
    realtime: marketDataSource === 'websocket' ? 'websocket' : 'disabled',
    ...(marketHistory ? { history: marketHistory } : {}),
  };
}
