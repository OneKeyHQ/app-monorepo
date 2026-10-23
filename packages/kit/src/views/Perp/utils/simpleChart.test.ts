import {
  getSimpleChartDisplayPerformance,
  getSimpleChartPerformance,
  getSimpleChartPoints,
  getSimpleChartRequest,
} from './simpleChart';

describe('simple Perps chart data', () => {
  it('calculates the displayed range change using its first and latest prices', () => {
    expect(
      getSimpleChartPerformance([
        [1, 100],
        [2, 80],
        [3, 110],
      ]),
    ).toEqual({
      change: '10',
      changePercent: 10,
    });
    expect(
      getSimpleChartPerformance([
        [1, 0.000_04],
        [2, 0.000_03],
      ]),
    ).toEqual({
      change: '-0.00001',
      changePercent: -25,
    });
  });

  it('leaves the change unavailable when the range has no valid baseline', () => {
    expect(getSimpleChartPerformance([])).toBeUndefined();
    expect(getSimpleChartPerformance([[1, 100]])).toBeUndefined();
    expect(
      getSimpleChartPerformance([
        [1, 0],
        [2, 100],
      ]),
    ).toBeUndefined();
    expect(
      getSimpleChartPerformance([
        [1, 100],
        [2, NaN],
      ]),
    ).toBeUndefined();
  });
  it.each([
    ['1H', '1m', 3600],
    ['1D', '5m', 86_400],
    ['1W', '1h', 7 * 86_400],
    ['1M', '4h', 30 * 86_400],
    ['1Y', '1d', 365 * 86_400],
  ] as const)(
    'requests the full %s window in seconds',
    (range, interval, seconds) => {
      const now = 1_800_000_000;
      expect(getSimpleChartRequest(range, now)).toEqual({
        interval,
        intervalSeconds: expect.any(Number),
        timeFrom: now - seconds,
        timeTo: now,
      });
    },
  );

  it('requests all available daily history for All', () => {
    expect(getSimpleChartRequest('All', 1_800_000_000)).toEqual({
      interval: '1d',
      intervalSeconds: 86_400,
      timeFrom: 0,
      timeTo: 1_800_000_000,
    });
  });

  it('sorts and deduplicates prices while rejecting invalid and out-of-range candles', () => {
    const candle = { o: 1, h: 3, l: 1, v: 1 };
    expect(
      getSimpleChartPoints({
        timeFrom: 100,
        timeTo: 400,
        points: [
          { ...candle, t: 300, c: 2 },
          { ...candle, t: 100, c: 1 },
          { ...candle, t: 300, c: 3 },
          { ...candle, t: 50, c: 1 },
          { ...candle, t: 401, c: 1 },
          { ...candle, t: 200, c: Number.NaN },
          { ...candle, t: 250, c: 0 },
        ],
      }),
    ).toEqual([
      [100, 1],
      [300, 3],
    ]);
  });
});

describe('simple chart summary fallback', () => {
  const dayPerformance = { change: '-10', changePercent: -5 };

  it('uses 24-hour performance for an unavailable 1D range or candlestick mode', () => {
    expect(getSimpleChartDisplayPerformance(undefined, dayPerformance)).toEqual(
      dayPerformance,
    );
    expect(
      getSimpleChartDisplayPerformance(
        { coin: 'BTC', range: '1D' },
        dayPerformance,
      ),
    ).toEqual(dayPerformance);
  });

  it('does not label 24-hour performance as a different selected range', () => {
    const performance = { coin: 'BTC', range: '1W' as const };
    expect(
      getSimpleChartDisplayPerformance(performance, dayPerformance),
    ).toEqual(performance);
  });

  it('preserves computed performance including a zero change', () => {
    const performance = {
      coin: 'BTC',
      range: '1D' as const,
      change: '0',
      changePercent: 0,
    };
    expect(
      getSimpleChartDisplayPerformance(performance, dayPerformance),
    ).toEqual(performance);
  });

  it('calculates the amount and percent for a held chart point together', () => {
    expect(
      getSimpleChartPerformance(
        [
          [1, 100],
          [2, 110],
          [3, 120],
        ],
        110,
      ),
    ).toEqual({ change: '10', changePercent: 10 });
  });
});
