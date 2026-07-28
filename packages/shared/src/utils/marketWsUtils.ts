import type {
  IMarketWsPriceData,
  IMarketWsPriceUpdate,
} from '../../types/marketV2';

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
      return interval ?? '1m';
  }
}

export function isMarketWsPriceData(
  data: unknown,
): data is IMarketWsPriceUpdate {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IMarketWsPriceData>;
  return (
    typeof candidate.address === 'string' &&
    typeof candidate.c === 'number' &&
    Number.isFinite(candidate.c) &&
    typeof candidate.unixTime === 'number' &&
    Number.isFinite(candidate.unixTime)
  );
}

export function isMarketWsOhlcvData(data: unknown): data is IMarketWsPriceData {
  if (!isMarketWsPriceData(data)) {
    return false;
  }

  return (
    data.eventType === 'ohlcv' &&
    typeof data.symbol === 'string' &&
    typeof data.type === 'string' &&
    typeof data.o === 'number' &&
    Number.isFinite(data.o) &&
    typeof data.h === 'number' &&
    Number.isFinite(data.h) &&
    typeof data.l === 'number' &&
    Number.isFinite(data.l) &&
    typeof data.v === 'number' &&
    Number.isFinite(data.v) &&
    data.h >= data.l
  );
}
