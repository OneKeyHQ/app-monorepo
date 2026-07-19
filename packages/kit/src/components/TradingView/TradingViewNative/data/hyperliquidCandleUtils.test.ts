import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { normalizeHyperliquidCandle } from './hyperliquidCandleUtils';
import { getTradingViewNativeKLineInterval } from './tradingViewNativeIntervals';

function buildCandle(overrides: Partial<ICandle> = {}): ICandle {
  return {
    t: 1_720_000_000_123,
    T: 1_720_000_059_999,
    s: 'BTC',
    i: '1m',
    o: '63000.25',
    h: '64000.5',
    l: '62500.75',
    c: '63500.125',
    v: '12.5',
    n: 42,
    ...overrides,
  };
}

describe('TradingViewNative Hyperliquid candle utilities', () => {
  it.each([
    ['1', '1m'],
    ['5', '5m'],
    ['15', '15m'],
    ['30', '30m'],
    ['60', '1h'],
    ['240', '4h'],
    ['1D', '1d'],
    ['1W', '1w'],
  ] as const)('maps chart interval %s to %s', (chartInterval, expected) => {
    expect(
      getTradingViewNativeKLineInterval(chartInterval)?.hyperliquidValue,
    ).toBe(expected);
  });

  it('normalizes millisecond timestamps and numeric strings', () => {
    expect(normalizeHyperliquidCandle(buildCandle())).toEqual({
      o: 63_000.25,
      h: 64_000.5,
      l: 62_500.75,
      c: 63_500.125,
      v: 12.5,
      t: 1_720_000_000,
    });
  });

  it('rejects malformed candles', () => {
    expect(
      normalizeHyperliquidCandle(buildCandle({ c: 'invalid' })),
    ).toBeNull();
    expect(
      normalizeHyperliquidCandle(buildCandle({ h: '62000', l: '63000' })),
    ).toBeNull();
  });
});
