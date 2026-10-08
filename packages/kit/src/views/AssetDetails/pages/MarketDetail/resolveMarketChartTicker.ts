import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

const SUPPORTED_MARKETS = new Set([
  'binance',
  'bybit',
  'mexc',
  'bitget',
  'coinbase',
  'bitfinex',
  'kraken',
  'okx',
  'gate',
  'kucoin',
]);
const QUOTE_TOKENS = new Set(['USD', 'USDT', 'USDC']);
type IChartTicker = NonNullable<IMarketTokenDetail['tvPlatform']>;

const STABLECOIN_TICKERS: Record<string, IChartTicker> = {
  'tether': { identifier: 'COINBASE', baseToken: 'USDT', targetToken: 'USD' },
  'usd-coin': { identifier: 'KRAKEN', baseToken: 'USDC', targetToken: 'USD' },
};

export function resolveMarketChartTicker(
  coinGeckoId: string,
  {
    tvPlatform,
    tickers,
    fallbackToChart,
  }: Pick<IMarketTokenDetail, 'tvPlatform' | 'tickers' | 'fallbackToChart'>,
): IChartTicker | undefined {
  if (fallbackToChart) {
    return undefined;
  }
  if (
    tvPlatform?.identifier &&
    tvPlatform.baseToken &&
    tvPlatform.targetToken
  ) {
    return tvPlatform;
  }
  if (!tickers?.length) {
    return undefined;
  }
  if (STABLECOIN_TICKERS[coinGeckoId]) {
    return STABLECOIN_TICKERS[coinGeckoId];
  }
  for (const ticker of tickers) {
    const identifier = SUPPORTED_MARKETS.has(ticker.market.identifier)
      ? ticker.market.identifier
      : ticker.market.name.toLowerCase();
    if (QUOTE_TOKENS.has(ticker.target) && SUPPORTED_MARKETS.has(identifier)) {
      return {
        identifier: identifier === 'gate' ? 'GATEIO' : identifier,
        baseToken: ticker.base,
        targetToken: ticker.target,
      };
    }
  }
  return undefined;
}
