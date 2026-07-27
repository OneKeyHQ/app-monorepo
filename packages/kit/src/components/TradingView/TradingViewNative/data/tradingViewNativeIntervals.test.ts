import {
  TRADING_VIEW_NATIVE_KLINE_INTERVALS,
  buildTradingViewNativeGoToDateTimeRange,
  getTradingViewNativeKLineIntervalForTimeRange,
} from './tradingViewNativeIntervals';

const DAY_SECONDS = 24 * 60 * 60;

describe('TradingViewNative go-to-date time range', () => {
  it('centers a minimum seven-day range on the selected timestamp', () => {
    const timestamp = 1_751_328_000;

    expect(buildTradingViewNativeGoToDateTimeRange({ timestamp })).toEqual({
      from: timestamp - (7 * DAY_SECONDS) / 2,
      to: timestamp + (7 * DAY_SECONDS) / 2,
    });
  });

  it('preserves a visible range that is wider than seven days', () => {
    const timestamp = 1_751_328_000;
    const visibleRangeSpan = 10 * DAY_SECONDS;

    expect(
      buildTradingViewNativeGoToDateTimeRange({
        timestamp,
        visibleRange: {
          from: 100,
          to: 100 + visibleRangeSpan,
        },
      }),
    ).toEqual({
      from: timestamp - visibleRangeSpan / 2,
      to: timestamp + visibleRangeSpan / 2,
    });
  });
});

describe('TradingViewNative adaptive time-range interval', () => {
  it.each([
    [DAY_SECONDS, '1'],
    [DAY_SECONDS + 1, '15'],
    [5 * DAY_SECONDS, '15'],
    [5 * DAY_SECONDS + 1, '60'],
    [30 * DAY_SECONDS, '60'],
    [30 * DAY_SECONDS + 1, '240'],
    [90 * DAY_SECONDS, '240'],
    [90 * DAY_SECONDS + 1, '1D'],
    [365 * DAY_SECONDS, '1D'],
    [365 * DAY_SECONDS + 1, '1W'],
    [3 * 365 * DAY_SECONDS, '1W'],
    [3 * 365 * DAY_SECONDS + 1, '1M'],
  ])('maps a %s-second range to %s', (rangeSeconds, expectedInterval) => {
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        currentInterval: '1',
        from: 1_700_000_000,
        to: 1_700_000_000 + rangeSeconds,
      }).value,
    ).toBe(expectedInterval);
  });

  it('keeps the current interval when it is already coarser', () => {
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        currentInterval: '240',
        from: 1_700_000_000,
        to: 1_700_000_000 + 2 * DAY_SECONDS,
      }).value,
    ).toBe('240');
  });

  it('uses the chart width and minimum zoom to fit the selected range', () => {
    const from = 1_700_000_000;
    const to = from + 2 * DAY_SECONDS;

    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        chartWidth: 320,
        currentInterval: '1',
        from,
        to,
      }).value,
    ).toBe('15');
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        chartWidth: 1000,
        currentInterval: '1',
        from,
        to,
      }).value,
    ).toBe('15');
  });

  it('keeps a selected range within the native Market page budget', () => {
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        chartWidth: 2000,
        currentInterval: '1',
        from: 1_700_000_000,
        to: 1_700_000_000 + 30 * DAY_SECONDS,
      }).value,
    ).toBe('240');
  });

  it('uses monthly candles when a multi-year range is too wide for weekly candles', () => {
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        chartWidth: 256,
        currentInterval: '1',
        from: 1_100_000_000,
        to: 1_100_000_000 + 10 * 365 * DAY_SECONDS,
      }).value,
    ).toBe('1M');
  });

  it('returns a supported interval for invalid ranges', () => {
    expect(
      getTradingViewNativeKLineIntervalForTimeRange({
        currentInterval: 'unknown',
        from: 200,
        to: 100,
      }),
    ).toBe(TRADING_VIEW_NATIVE_KLINE_INTERVALS[4]);
  });
});
