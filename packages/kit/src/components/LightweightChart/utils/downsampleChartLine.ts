import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

/**
 * Thins a line to at most `maxPoints` by keeping every n-th point, counted
 * back from the latest one: each kept point is the close of a coarser bar, the
 * same series a longer API interval would return. The spacing stays even, so
 * the chart's evenly spaced time axis still reads linearly and every hover step
 * covers the same span. The first point is kept too, as the range's baseline.
 */
export function downsampleChartLine(
  data: IMarketTokenChart,
  maxPoints: number,
): IMarketTokenChart {
  const count = data.length;
  const limit = Math.floor(maxPoints);
  if (limit >= count || limit < 2) {
    return data;
  }
  // One slot goes to the first point, the rest to evenly spaced closes.
  const step = Math.ceil((count - 1) / (limit - 1));
  const sampled: IMarketTokenChart = [];
  for (let index = count - 1; index > 0; index -= step) {
    sampled.push(data[index]);
  }
  sampled.push(data[0]);
  return sampled.toReversed();
}
