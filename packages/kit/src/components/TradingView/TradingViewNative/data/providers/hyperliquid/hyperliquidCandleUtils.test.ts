import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getTradingViewNativeKLineInterval } from '../../tradingViewNativeIntervals';

import {
  aggregateHyperliquidCalendarCandles,
  getHyperliquidCalendarBucketEnd,
  getHyperliquidCalendarBucketStart,
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

describe('Hyperliquid calendar history', () => {
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
  it.each([
    ['2026-01-01', '1w', '2025-12-29', '2026-01-05'],
    ['2024-02-29', '1M', '2024-02-01', '2024-03-01'],
    ['2025-12-31', '1M', '2025-12-01', '2026-01-01'],
  ] as const)(
    'uses UTC calendar boundaries for %s %s',
    (date, interval, from, to) => {
      expect(
        getHyperliquidCalendarBucketStart(Date.parse(date) / 1000, interval),
      ).toBe(Date.parse(from) / 1000);
      expect(
        getHyperliquidCalendarBucketEnd(Date.parse(date) / 1000, interval),
      ).toBe(Date.parse(to) / 1000 - 1);
    },
  );
  it('sorts days and replaces duplicate snapshots before aggregating volume', () => {
    const first = {
      t: Date.parse('2026-10-05') / 1000,
      o: 100,
      h: 120,
      l: 90,
      c: 110,
      v: 5,
    };
    const second = {
      t: first.t + 86_400,
      o: 110,
      h: 130,
      l: 105,
      c: 125,
      v: 10,
    };
    expect(
      aggregateHyperliquidCalendarCandles(
        [second, first, { ...second, c: 128, v: 11 }],
        '1w',
      ),
    ).toEqual([{ ...first, h: 130, c: 128, v: 16 }]);
  });
  // Public mainnet @142 daily snapshot, fetched on 2026-10-09.
  const dailySnapshot = [
    [1_738_540_800_000, 100_002_060, 100_002_060, 6_969_696, 6_969_696, 5e-5],
    [1_738_627_200_000, 6_969_696, 6_969_696, 6_969_696, 6_969_696, 0],
    [1_738_713_600_000, 6_969_696, 6_969_696, 6_969_696, 6_969_696, 0],
    [1_738_800_000_000, 6_969_696, 6_969_696, 6_969_696, 6_969_696, 0],
    [1_738_886_400_000, 6_969_696, 6_969_696, 6_969_696, 6_969_696, 0],
    [1_738_972_800_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 1e-5],
    [1_739_059_200_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 0],
    [1_739_145_600_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 0],
    [1_739_232_000_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 0],
    [1_739_318_400_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 0],
    [1_739_404_800_000, 7_979_573, 7_979_573, 7_979_573, 7_979_573, 0],
    [1_739_491_200_000, 240_000, 240_000, 96_000, 97_578, 145.311_51],
    [1_739_577_600_000, 97_567, 98_000, 97_252, 97_597, 159.6464],
    [1_739_664_000_000, 97_581, 97_751, 96_210, 96_243, 105.241_22],
    [1_739_750_400_000, 96_243, 96_991, 95_230, 95_773, 238.759_95],
    [1_739_836_800_000, 95_775, 96_619, 93_320, 95_649, 282.335_49],
    [1_739_923_200_000, 95_650, 97_000, 95_000, 96_677, 247.124_36],
    [1_740_009_600_000, 96_676, 98_806, 96_445, 98_239, 304.200_87],
    [1_740_096_000_000, 98_239, 99_481, 94_950, 96_192, 317.570_81],
    [1_740_182_400_000, 96_191, 97_059, 95_301, 96_576, 178.102_08],
    [1_740_268_800_000, 96_575, 96_660, 95_200, 96_312, 101.567_86],
    [1_740_355_200_000, 96_311, 96_445, 91_352, 91_591, 273.552_06],
    [1_740_441_600_000, 91_591, 92_575, 86_059, 88_609, 576.211_66],
    [1_740_528_000_000, 88_580, 89_369, 82_222, 84_062, 518.3873],
    [1_740_614_400_000, 84_079, 87_003, 82_625, 84_658, 277.186_14],
    [1_740_700_800_000, 84_653, 85_000, 78_259, 84_276, 580.878_34],
  ];
  it('matches the first calendar week and month from the public BTC spot sample', () => {
    const points = dailySnapshot
      .map(([t, o, h, l, c, v]) =>
        normalizeHyperliquidHistoryCandle(
          buildCandle({
            s: '@142',
            i: '1d',
            t: Number(t),
            T: Number(t) + 86_400_000 - 1,
            o: String(o),
            h: String(h),
            l: String(l),
            c: String(c),
            v: String(v),
          }),
          'mainnet',
        ),
      )
      .filter((point) => point !== null);
    expect(aggregateHyperliquidCalendarCandles(points, '1w')[0]).toMatchObject({
      t: Date.parse('2025-02-10') / 1000,
      o: 98_998,
      h: 98_998,
      l: 96_000,
      c: 96_243,
    });
    expect(aggregateHyperliquidCalendarCandles(points, '1M')[0]).toMatchObject({
      t: Date.parse('2025-02-01') / 1000,
      o: 98_998,
      h: 99_481,
      l: 78_259,
      c: 84_276,
    });
  });
});
