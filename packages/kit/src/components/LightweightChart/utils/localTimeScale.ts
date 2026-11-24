import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

// lightweight-charts has no time zone support: it places ticks and decides
// which tick marks a new day in UTC. Feeding it each timestamp shifted by the
// device's offset makes the time scale run on local wall-clock time, so the
// date tick lands on local midnight. The offset is taken per point so a range
// that spans a DST change stays correct.
export function getLocalTimeOffsetSeconds(timestampSeconds: number) {
  return -new Date(timestampSeconds * 1000).getTimezoneOffset() * 60;
}

export type ILocalTimeScale = {
  data: IMarketTokenChart;
  // Maps a time the chart reports back (crosshair) to the source timestamp.
  toUtcTimestamp: (localTimeSeconds: number) => number;
};

export function createLocalTimeScale(data: IMarketTokenChart): ILocalTimeScale {
  const utcByLocalTime = new Map<number, number>();
  let previousLocalTime = -Infinity;
  const localData: IMarketTokenChart = data.map(([time, value]) => {
    // A DST fall-back repeats an hour of wall-clock time, while the chart
    // requires strictly increasing times. A point that would not move forward
    // is placed one second after the previous one; the time axis is
    // index-based, so this does not move it on screen.
    const localTime = Math.max(
      time + getLocalTimeOffsetSeconds(time),
      previousLocalTime + 1,
    );
    previousLocalTime = localTime;
    utcByLocalTime.set(localTime, time);
    return [localTime, value];
  });
  return {
    data: localData,
    toUtcTimestamp: (localTimeSeconds) =>
      utcByLocalTime.get(localTimeSeconds) ??
      localTimeSeconds - getLocalTimeOffsetSeconds(localTimeSeconds),
  };
}
