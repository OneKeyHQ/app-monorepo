import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import { downsampleChartLine } from './downsampleChartLine';

// Five-minute bars, like the simple chart's 1D series.
const series = (count: number): IMarketTokenChart =>
  Array.from({ length: count }, (_, index) => [index * 300, index]);

describe('downsampleChartLine', () => {
  it('returns the data untouched when it already fits', () => {
    const data = series(4);
    expect(downsampleChartLine(data, 4)).toBe(data);
    expect(downsampleChartLine(data, 10)).toBe(data);
    expect(downsampleChartLine(data, 1)).toBe(data);
  });

  it('keeps the first and the latest point within the limit', () => {
    const data = series(288);
    const sampled = downsampleChartLine(data, 72);
    expect(sampled.length).toBeLessThanOrEqual(72);
    expect(sampled[0]).toBe(data[0]);
    expect(sampled.at(-1)).toBe(data.at(-1));
  });

  it('spaces the kept points evenly back from the latest one', () => {
    const sampled = downsampleChartLine(series(288), 72);
    const gaps = sampled
      .slice(1)
      .map(([time], index) => time - sampled[index][0]);
    // 287 gaps into 71 slots: every 5th bar, i.e. one point per 25 minutes,
    // with only the first gap left short.
    expect(new Set(gaps.slice(1))).toEqual(new Set([1500]));
    expect(gaps[0]).toBeLessThanOrEqual(1500);
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
