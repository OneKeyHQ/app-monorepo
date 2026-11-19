import { getTradingViewNativeWhitelistedHyperliquidSource } from './tradingViewNativeHyperliquidWhitelist';

import type { ITradingViewNativeHyperliquidWhitelistBranch } from './tradingViewNativeHyperliquidWhitelist';
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
  if (source.kind === 'asset') {
    return `asset:${source.assetId.trim().toLowerCase()}`;
  }
  if (source.kind === 'hyperliquid') {
    return `hyperliquid:${source.environment}:${source.coin.trim()}`;
  }
  if (source.kind === 'stock') {
    return `stock:${source.stockId.trim().toUpperCase()}`;
  }
  const marketTokenKey = getTradingViewNativeMarketTokenKey(source);
  const hasTokenAddress = Boolean(
    normalizeMarketTokenAddress(source.tokenAddress),
  );
  const marketSourceKey = `${marketTokenKey}${
    hasTokenAddress ? '' : `:${normalizeMarketSymbol(source.symbol)}`
  }${source.isNative ? ':native' : ''}`;
  const normalizedFallbackCoinGeckoId = source.fallbackCoinGeckoId?.trim();
  return normalizedFallbackCoinGeckoId
    ? `${marketSourceKey}:coingecko:${normalizedFallbackCoinGeckoId}`
    : marketSourceKey;
}

export function getTradingViewNativeSource({
  fallbackCoinGeckoId,
  hyperliquidCoin,
  hyperliquidWhitelistBranch,
  isNative,
  marketDataSource,
  networkId,
  symbol,
  tokenAddress,
}: {
  fallbackCoinGeckoId?: string;
  hyperliquidCoin: string;
  hyperliquidWhitelistBranch?: ITradingViewNativeHyperliquidWhitelistBranch;
  isNative?: boolean;
  marketDataSource: 'polling' | 'websocket' | undefined;
  networkId: string;
  symbol: string;
  tokenAddress: string;
}): ITradingViewNativeSource {
  const whitelistedSource = hyperliquidWhitelistBranch
    ? getTradingViewNativeWhitelistedHyperliquidSource({
        branch: hyperliquidWhitelistBranch,
        token: { isNative, networkId, tokenAddress },
      })
    : undefined;
  const normalizedHyperliquidCoin = (
    whitelistedSource?.coin ?? hyperliquidCoin
  ).trim();
  if (normalizedHyperliquidCoin) {
    return {
      kind: 'hyperliquid',
      coin: normalizedHyperliquidCoin,
      environment: 'mainnet',
    };
  }

  const marketSource: Extract<ITradingViewNativeSource, { kind: 'market' }> = {
    kind: 'market',
    ...(isNative ? { isNative: true } : {}),
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
