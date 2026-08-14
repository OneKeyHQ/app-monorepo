import {
  isMarketWsOhlcvData,
  isMarketWsPriceData,
  normalizeMarketWsKLineInterval,
} from './marketWsUtils';

const validOhlcvData = {
  address: '0xabc',
  symbol: 'TOKEN',
  eventType: 'ohlcv' as const,
  type: '1h',
  unixTime: 3600,
  o: 100,
  h: 110,
  l: 90,
  c: 105,
  v: 20,
};

describe('Market WebSocket utilities', () => {
  it.each([
    ['1', '1m'],
    ['60', '1h'],
    ['1H', '1h'],
    ['240', '4h'],
    ['1D', '1d'],
    ['1W', '1w'],
  ])('normalizes chart interval %s to %s', (input, expected) => {
    expect(normalizeMarketWsKLineInterval(input)).toBe(expected);
  });

  it('uses a minimal validator for price-only consumers', () => {
    expect(
      isMarketWsPriceData({
        address: '0xabc',
        c: 105,
        type: '1h',
        unixTime: 3600,
      }),
    ).toBe(true);
    expect(
      isMarketWsPriceData({
        address: '0xabc',
        c: Number.NaN,
        type: '1h',
        unixTime: 3600,
      }),
    ).toBe(false);
  });

  it('validates the complete OHLCV contract for chart consumers', () => {
    expect(isMarketWsOhlcvData(validOhlcvData)).toBe(true);
    expect(isMarketWsOhlcvData({ ...validOhlcvData, h: 80 })).toBe(false);
    expect(isMarketWsOhlcvData({ ...validOhlcvData, symbol: undefined })).toBe(
      false,
    );
  });
});
