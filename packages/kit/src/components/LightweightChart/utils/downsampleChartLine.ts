import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

function getBarInterval(data: IMarketTokenChart) {
  let interval = Number.POSITIVE_INFINITY;
  for (let i = 1; i < data.length; i += 1) {
    const gap = data[i][0] - data[i - 1][0];
    if (gap > 0 && gap < interval) interval = gap;
  }
  return Number.isFinite(interval) ? interval : undefined;
}

/**
 * Thins a line to at most `maxPoints` by keeping the bars that open on a
 * coarser grid of absolute time, like the closes a longer API interval would
 * return. The grid does not move as new bars arrive, so a refresh only adds a
 * point at the end instead of reshuffling the history, and the spacing stays
 * even for the chart's evenly spaced time axis. The first and the latest bar
 * are always kept, so the drawn range and the live tail are unchanged.
 */
export function downsampleChartLine(
  data: IMarketTokenChart,
  maxPoints: number,
): IMarketTokenChart {
  const count = data.length;
  const limit = Math.floor(maxPoints);
  // Two slots are held back for the first and the latest bar.
  if (limit >= count || limit < 4) {
    return data;
  }
  const interval = getBarInterval(data);
  if (interval === undefined) {
    return data;
  }
  const step = Math.ceil((count - 1) / (limit - 3));
  return data.filter(
    ([time], index) =>
      index === 0 ||
      index === count - 1 ||
      Math.round(time / interval) % step === 0,
  );
}
