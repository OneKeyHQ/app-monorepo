import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';

export function normalizeMarketWsKLineInterval(
  interval: string | undefined,
): string {
  switch (interval) {
    case '1':
    case '1m':
      return '1m';
    case '5':
    case '5m':
      return '5m';
    case '15':
    case '15m':
      return '15m';
    case '30':
    case '30m':
      return '30m';
    case '60':
    case '1h':
    case '1H':
      return '1h';
    case '240':
    case '4h':
    case '4H':
      return '4h';
    case '1d':
    case '1D':
      return '1d';
    case '1w':
    case '1W':
      return '1w';
    default:
      return interval || '1m';
  }
}

export function isMarketWsPriceData(data: unknown): data is IWsPriceData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IWsPriceData>;
  return (
    typeof candidate.address === 'string' &&
    typeof candidate.c === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.unixTime === 'number'
  );
}
