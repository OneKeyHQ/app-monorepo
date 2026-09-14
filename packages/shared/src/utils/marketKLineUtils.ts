export function normalizeMarketApiKLineInterval(
  interval: string | undefined,
): string | undefined {
  const unit = interval?.slice(-1);

  if (unit === 'm' || unit === 's') {
    return interval?.toLowerCase();
  }

  return interval?.toUpperCase();
}

// Case matters in this API's interval strings: lowercase `m` is minutes,
// uppercase `M` is months. Months are deliberately absent — they have no
// fixed length, so no caller can treat one as a bucket width.
const KLINE_INTERVAL_UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  H: 60 * 60,
  D: 24 * 60 * 60,
  W: 7 * 24 * 60 * 60,
};

/** Bucket width in seconds for an API interval string ("5m", "1H", "1D"). */
export function getMarketApiKLineIntervalSeconds(
  interval: string | undefined,
): number | undefined {
  const match = /^(\d+)([smHDW])$/.exec(interval?.trim() ?? '');
  if (!match) {
    return undefined;
  }
  const size = Number(match[1]);
  const unitSeconds = KLINE_INTERVAL_UNIT_SECONDS[match[2]];
  if (!Number.isFinite(size) || size <= 0 || !unitSeconds) {
    return undefined;
  }
  return size * unitSeconds;
}

// A day of 1m buckets is 1440 points; this leaves room for that and for a
// wide range at a coarse interval, while refusing to expand a pathological
// response (two points a month apart at 1m) into tens of thousands.
const MAX_FILLED_KLINE_POINTS = 3000;

/**
 * Carry the last close across buckets a sparse feed skipped.
 *
 * The token K-line endpoint only returns buckets that actually traded, so a
 * thin market comes back with irregular gaps. The chart draws points at even
 * horizontal spacing regardless of their timestamps, so those gaps get drawn
 * as if they were single steps — the line ends up compressed and the time
 * axis stops matching the data. Filling the holes with the previous close
 * (no trades means the price did not move) restores the 1:1 mapping.
 *
 * Only fills between the first and last point: outside that range there is no
 * price to carry. Returns the input untouched when the interval is unknown or
 * the result would exceed the point cap.
 */
export function fillMarketKLineGaps(
  points: [number, number][],
  intervalSeconds: number | undefined,
): [number, number][] {
  if (
    !intervalSeconds ||
    intervalSeconds <= 0 ||
    !Number.isFinite(intervalSeconds) ||
    points.length < 2
  ) {
    return points;
  }

  const first = points[0][0];
  const last = points[points.length - 1][0];
  // `expected <= points.length` also covers a feed denser than the grid: this
  // fills holes, it does not re-bucket, so such a series is left alone.
  const expected = Math.floor((last - first) / intervalSeconds) + 1;
  if (expected <= points.length || expected > MAX_FILLED_KLINE_POINTS) {
    return points;
  }

  const filled: [number, number][] = [];
  let cursor = 0;
  for (let t = first; t <= last; t += intervalSeconds) {
    // Consume every point that belongs to this bucket; the last one wins so a
    // bucket carrying several ticks keeps its close.
    while (cursor < points.length && points[cursor][0] < t + intervalSeconds) {
      cursor += 1;
    }
    const price = points[Math.max(cursor - 1, 0)][1];
    filled.push([t, price]);
  }
  return filled;
}
