import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getTradingViewNativeKLineInterval } from '../../tradingViewNativeIntervals';

import {
  normalizeHyperliquidCandle,
  normalizeHyperliquidHistoryCandle,
} from './hyperliquidCandleUtils';

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
    ['1M', '1M'],
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

describe('Hyperliquid history boundaries', () => {
  const boundaryCandle = buildCandle({
    s: '@142',
    i: '1d',
    t: Date.parse('2025-02-14T00:00:00Z'),
    T: Date.parse('2025-02-15T00:00:00Z') - 1,
    o: '240000',
    h: '240000',
    l: '96000',
    c: '97578',
  });
  it('retains the boundary day with Hyperliquid chart prices', () => {
    expect(
      normalizeHyperliquidHistoryCandle(boundaryCandle, 'mainnet'),
    ).toEqual({
      t: boundaryCandle.t / 1000,
      o: 98_998,
      h: 98_998,
      l: 96_000,
      c: 97_578,
      v: 12.5,
    });
  });
  it('keeps boundary OHLC valid when all original prices exceed the cap', () => {
    expect(
      normalizeHyperliquidHistoryCandle(
        { ...boundaryCandle, l: '120000', c: '200000' },
        'mainnet',
      ),
    ).toMatchObject({
      o: 98_998,
      h: 98_998,
      l: 98_998,
      c: 98_998,
    });
  });
  it('excludes wholly earlier candles but retains a candle ending at the boundary', () => {
    expect(
      normalizeHyperliquidHistoryCandle(
        { ...boundaryCandle, T: 1_739_556_000_000 - 1 },
        'mainnet',
      ),
    ).toBeNull();
    expect(
      normalizeHyperliquidHistoryCandle(
        { ...boundaryCandle, T: 1_739_556_000_000 },
        'mainnet',
      ),
    ).not.toBeNull();
  });
  it.each(['BTC', 'ETH', '@234'])('does not filter or cap %s', (s) => {
    const candle = { ...boundaryCandle, s };
    expect(normalizeHyperliquidHistoryCandle(candle, 'mainnet')).toEqual(
      normalizeHyperliquidCandle(candle),
    );
  });
  it('does not apply mainnet policy to testnet or post-boundary candles', () => {
    expect(
      normalizeHyperliquidHistoryCandle(boundaryCandle, 'testnet'),
    ).toEqual(normalizeHyperliquidCandle(boundaryCandle));
    const candle = { ...boundaryCandle, t: 1_739_556_000_000 };
    expect(normalizeHyperliquidHistoryCandle(candle, 'mainnet')).toEqual(
      normalizeHyperliquidCandle(candle),
    );
  });
  it('normalizes the public ETH boundary sample without affecting testnet or later prices', () => {
    // Public mainnet @151 daily snapshot, fetched on 2026-10-09.
    const candle = buildCandle({
      s: '@151',
      i: '1d',
      t: 1_743_033_600_000,
      T: 1_743_119_999_999,
      o: '3044.0',
      h: '3045.0',
      l: '1910.1',
      c: '2003.0',
      v: '441.1893',
      n: 2385,
    });
    expect(normalizeHyperliquidHistoryCandle(candle, 'mainnet')).toEqual({
      t: 1_743_033_600,
      o: 2021,
      h: 2021,
      l: 1910.1,
      c: 2003,
      v: 441.1893,
    });
    expect(normalizeHyperliquidHistoryCandle(candle, 'testnet')).toEqual(
      normalizeHyperliquidCandle(candle),
    );
    const laterCandle = { ...candle, t: 1_743_085_980_000 };
    expect(normalizeHyperliquidHistoryCandle(laterCandle, 'mainnet')).toEqual(
      normalizeHyperliquidCandle(laterCandle),
    );
    expect(
      normalizeHyperliquidHistoryCandle(
        { ...candle, T: 1_743_085_980_000 - 1 },
        'mainnet',
      ),
    ).toBeNull();
  });
});
