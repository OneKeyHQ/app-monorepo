import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { downsampleChartLine } from './downsampleChartLine';

const FIVE_MINUTES = 300;

// Five-minute bars, like the simple chart's 1D series.
const series = (count: number, firstBar = 0): IMarketTokenChart =>
  Array.from({ length: count }, (_, index) => [
    (firstBar + index) * FIVE_MINUTES,
    index,
  ]);

const interior = (sampled: IMarketTokenChart) =>
  sampled.slice(1, -1).map(([time]) => time);

describe('downsampleChartLine', () => {
  it('returns the data untouched when it already fits', () => {
    const data = series(4);
    expect(downsampleChartLine(data, 4)).toBe(data);
    expect(downsampleChartLine(data, 10)).toBe(data);
    expect(downsampleChartLine(series(50), 3)).toHaveLength(50);
  });

  it('keeps the first and the latest bar within the limit', () => {
    const data = series(288);
    const sampled = downsampleChartLine(data, 72);
    expect(sampled.length).toBeLessThanOrEqual(72);
    expect(sampled[0]).toBe(data[0]);
    expect(sampled.at(-1)).toBe(data.at(-1));
  });

  it('keeps bars on an even grid of absolute time', () => {
    // 287 bars over 69 slots: every 5th bar, i.e. 25-minute closes.
    const times = interior(downsampleChartLine(series(288, 7), 72));
    const gaps = times.slice(1).map((time, index) => time - times[index]);
    expect(new Set(gaps)).toEqual(new Set([5 * FIVE_MINUTES]));
    times.forEach((time) => {
      expect((time / FIVE_MINUTES) % 5).toBe(0);
    });
  });

  it('keeps the history in place when a new bar arrives', () => {
    const before = interior(downsampleChartLine(series(289), 97));
    const after = interior(downsampleChartLine(series(290), 97));
    expect(after.slice(0, before.length)).toEqual(before);
    // A rolling window drops its oldest bar and still lands on the same grid.
    const rolled = interior(downsampleChartLine(series(289, 1), 97));
    expect(rolled.filter((time) => before.includes(time))).toEqual(
      rolled.filter((time) => time <= before.at(-1)!),
    );
  });

  it('still thins when a live quote trails the last bar by a minute', () => {
    const data = series(288);
    const lastTime = data.at(-1)![0];
    const withLive: IMarketTokenChart = [...data, [lastTime + 60, 1]];
    const sampled = downsampleChartLine(withLive, 72);
    expect(sampled.length).toBeLessThanOrEqual(72);
    expect(sampled.at(-1)).toBe(withLive.at(-1));
  });

  it('keeps only real samples, in time order', () => {
    const data = series(50);
    const sampled = downsampleChartLine(data, 12);
    sampled.forEach((point) => {
      expect(data).toContain(point);
    });
    const times = sampled.map(([time]) => time);
    expect(times).toEqual(times.toSorted((a, b) => a - b));
  });
});
