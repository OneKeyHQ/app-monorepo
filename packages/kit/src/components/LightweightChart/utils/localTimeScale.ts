import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

// lightweight-charts has no time zone support: it places ticks and decides
// which tick marks a new day in UTC. Feeding it each timestamp shifted by the
// device's offset makes the time scale run on local wall-clock time, so the
// date tick lands on local midnight. The offset is taken per point so a range
// that spans a DST change stays correct.
export function getLocalTimeOffsetSeconds(timestampSeconds: number) {
  return -new Date(timestampSeconds * 1000).getTimezoneOffset() * 60;
}

export function shiftChartToLocalTime(
  data: IMarketTokenChart,
): IMarketTokenChart {
  return data.map(([time, value]) => [
    time + getLocalTimeOffsetSeconds(time),
    value,
  ]);
}

// Inverse of the shift above, for times the chart reports back (crosshair).
// The second pass corrects the guess when the point sits next to a DST change.
export function toUtcTimestampFromLocalTime(localTimeSeconds: number) {
  const guess = localTimeSeconds - getLocalTimeOffsetSeconds(localTimeSeconds);
  return localTimeSeconds - getLocalTimeOffsetSeconds(guess);
}
