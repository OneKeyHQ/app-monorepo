import {
  getTradingViewNativeCandleSlotAtTime,
  getTradingViewNativeCandleTimestampAtOffset,
} from './candleTime';

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

  it.each([-1, 1, 2])(
    'keeps fixed buckets that start on February 1 fixed at offset %s',
    (offset) => {
      const timestamp = Date.UTC(2027, 1, 1) / 1000;
      expect(timestamp).toBe(695 * MONTH);
      expect(
        getTradingViewNativeCandleTimestampAtOffset({
          timestamp,
          offset,
          candleIntervalSeconds: MONTH,
          candleTimeMode: 'fixed',
        }),
      ).toBe(timestamp + offset * MONTH);
    },
  );
});

describe('the candle a time falls in', () => {
  const HOUR = 3600;
  const start = Date.UTC(2024, 0, 1) / 1000;
  // Four hourly candles with a gap after the second one.
  const points = [0, 1, 5, 6].map((hours) => ({ t: start + hours * HOUR }));
  const slotAt = (time: number) =>
    getTradingViewNativeCandleSlotAtTime({
      candleIntervalSeconds: HOUR,
      points,
      time,
    });

  it('finds the candle that covers a time from a finer chart', () => {
    expect(slotAt(start + HOUR + 59 * 60)).toEqual({
      index: 1,
      timestamp: start + HOUR,
    });
    expect(slotAt(start + 5 * HOUR)).toEqual({
      index: 2,
      timestamp: start + 5 * HOUR,
    });
  });

  it('gives a time inside a gap to the candle before the gap', () => {
    expect(slotAt(start + 3 * HOUR)).toEqual({
      index: 1,
      timestamp: start + HOUR,
    });
  });

  it('continues the slots past both ends of the data', () => {
    expect(slotAt(start + 6 * HOUR + 1)).toEqual({
      index: 3,
      timestamp: start + 6 * HOUR,
    });
    expect(slotAt(start + 8 * HOUR + 1)).toEqual({
      index: 5,
      timestamp: start + 8 * HOUR,
    });
    expect(slotAt(start - 1)).toEqual({
      index: -1,
      timestamp: start - HOUR,
    });
    expect(slotAt(start - 2 * HOUR)).toEqual({
      index: -2,
      timestamp: start - 2 * HOUR,
    });
  });

  it.each([
    [Date.UTC(2024, 2, 5), 2, Date.UTC(2024, 2, 1)],
    // 90 days after the anchor, yet still in its third calendar month.
    [Date.UTC(2024, 2, 31), 2, Date.UTC(2024, 2, 1)],
    [Date.UTC(2023, 11, 31), -1, Date.UTC(2023, 11, 1)],
  ])(
    'follows calendar months outside monthly candles at %s',
    (time, index, timestamp) => {
      expect(
        getTradingViewNativeCandleSlotAtTime({
          candleIntervalSeconds: MONTH,
          points: [{ t: Date.UTC(2024, 0, 1) / 1000 }],
          time: time / 1000,
        }),
      ).toEqual({ index, timestamp: timestamp / 1000 });
    },
  );

  it('has no slot without candles or a usable time', () => {
    expect(
      getTradingViewNativeCandleSlotAtTime({
        candleIntervalSeconds: HOUR,
        points: [],
        time: start,
      }),
    ).toBeNull();
    expect(slotAt(Number.NaN)).toBeNull();
  });
});
