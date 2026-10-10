import { getTradingViewNativeCandleTimestampAtOffset } from './candleTime';

const MONTH = 30 * 24 * 60 * 60;

describe('candle timestamps outside loaded data', () => {
  it.each([
    [Date.UTC(2026, 0, 1), 1, Date.UTC(2026, 1, 1)],
    [Date.UTC(2024, 0, 1), 2, Date.UTC(2024, 2, 1)],
    [Date.UTC(2024, 2, 1), -2, Date.UTC(2024, 0, 1)],
    [Date.UTC(2024, 0, 31, 16), 1, Date.UTC(2024, 1, 29, 16)],
    [Date.UTC(2024, 1, 29, 16), -2, Date.UTC(2023, 11, 31, 16)],
    [658 * MONTH * 1000, 1, 659 * MONTH * 1000],
    [658 * MONTH * 1000, -2, 656 * MONTH * 1000],
  ])('advances %s by %s monthly candles', (timestamp, offset, expected) => {
    expect(
      getTradingViewNativeCandleTimestampAtOffset({
        timestamp: timestamp / 1000,
        offset,
        candleIntervalSeconds: MONTH,
      }),
    ).toBe(expected / 1000);
  });
  it('retains fixed durations for other intervals', () => {
    const timestamp = Date.UTC(2024, 0, 1) / 1000;
    expect(
      getTradingViewNativeCandleTimestampAtOffset({
        timestamp,
        offset: -3,
        candleIntervalSeconds: 3600,
      }),
    ).toBe(timestamp - 3 * 3600);
  });
});
