import type { ITradingViewNativeSource } from '../types';

function normalizeMarketTokenAddress(tokenAddress: string) {
  const normalizedTokenAddress = tokenAddress.trim();
  return normalizedTokenAddress.startsWith('0x')
    ? normalizedTokenAddress.toLowerCase()
    : normalizedTokenAddress;
}

function normalizeMarketSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function getTradingViewNativeMarketTokenKey({
  networkId,
  tokenAddress,
}: Pick<
  Extract<ITradingViewNativeSource, { kind: 'market' }>,
  'networkId' | 'tokenAddress'
>) {
  return `market:${networkId.trim()}:${normalizeMarketTokenAddress(
    tokenAddress,
  )}`;
}

export function getTradingViewNativeSourceKey(
  source: ITradingViewNativeSource,
) {
  if (source.kind === 'hyperliquid') {
    return `hyperliquid:${source.environment}:${source.coin.trim()}`;
  }
  const marketSourceKey = `${getTradingViewNativeMarketTokenKey(
    source,
  )}:${normalizeMarketSymbol(source.symbol)}`;
  const normalizedFallbackCoinGeckoId = source.fallbackCoinGeckoId?.trim();
  return normalizedFallbackCoinGeckoId
    ? `${marketSourceKey}:coingecko:${normalizedFallbackCoinGeckoId}`
    : marketSourceKey;
}

export function getTradingViewNativeSource({
  fallbackCoinGeckoId,
  hyperliquidCoin,
  marketDataSource,
  networkId,
  symbol,
  tokenAddress,
}: {
  fallbackCoinGeckoId?: string;
  hyperliquidCoin: string;
  marketDataSource: 'polling' | 'websocket' | undefined;
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

  const marketSource: Extract<ITradingViewNativeSource, { kind: 'market' }> = {
    kind: 'market',
    networkId,
    tokenAddress,
    symbol,
    realtime: marketDataSource === 'websocket' ? 'websocket' : 'disabled',
  };
  const normalizedFallbackCoinGeckoId = fallbackCoinGeckoId?.trim();
  if (normalizedFallbackCoinGeckoId) {
    marketSource.fallbackCoinGeckoId = normalizedFallbackCoinGeckoId;
  }
  return marketSource;
}
