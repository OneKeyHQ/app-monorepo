export const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;
// History older than this no longer describes today's market.
const MAX_HISTORY_STALENESS_MS = 2 * DAY_MS;
// The history is pinned to today's price; past this gap the two sources
// disagree too much for the line to be shown as the same price.
const MAX_PIN_DEVIATION = 0.02;

export type IPtChartApyPoint = {
  timestamp: number;
  /** Implied APY in percent, e.g. "5.09". Missing or empty on a gap. */
  apy?: string | null;
};

// Number(null) and Number('') are 0, which would read a gap as a 0% rate.
function parseApyPercent(apy: IPtChartApyPoint['apy']): number {
  return typeof apy === 'string' && apy.trim() !== ''
    ? Number(apy)
    : Number.NaN;
}

export type IPtPricePoint = { time: number; price: number };

export type IPtPastPrices = {
  points: IPtPricePoint[];
  /** Time between two points. */
  stepMs: number;
};

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

// Date.UTC rolls a day the month doesn't have over, so 30 Feb would read as
// 2 March.
function getUtcMidnight(
  year: number,
  month: number,
  day: number,
): number | undefined {
  const time = Date.UTC(year, month, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
    ? time
    : undefined;
}

/**
 * The server sends the maturity only as a date, as "26 Nov 2026" today; the
 * ISO "2026-11-26" is read as well. Pendle markets expire at 00:00 UTC on
 * that day.
 */
export function parseMaturityDate(text?: string): number | undefined {
  const value = text?.trim() ?? '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return getUtcMidnight(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const match = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const month = MONTH_INDEX[match[2].toLowerCase()];
  if (month === undefined) {
    return undefined;
  }
  return getUtcMidnight(Number(match[3]), month, Number(match[1]));
}

export function resolveMaturityTime({
  maturityDate,
  remainingDays,
  now,
}: {
  maturityDate?: string;
  remainingDays: number;
  now: number;
}): number {
  return parseMaturityDate(maturityDate) ?? now + remainingDays * DAY_MS;
}

/** PT price in its accounting asset for an implied APY with time left. */
export function getPtPriceFromImpliedApy({
  apyPercent,
  daysToMaturity,
}: {
  apyPercent: number;
  daysToMaturity: number;
}): number {
  return (
    (1 + apyPercent / 100) ** (-Math.max(daysToMaturity, 0) / DAYS_PER_YEAR)
  );
}

/**
 * One point a day reads as a line down to two weeks; shorter spans need finer
 * points, or a market's last days draw as a few straight segments.
 */
export function getSampleStep(spanMs: number): number {
  if (spanMs >= 14 * DAY_MS) {
    return DAY_MS;
  }
  if (spanMs >= 3 * DAY_MS) {
    return 6 * HOUR_MS;
  }
  return HOUR_MS;
}

/**
 * PT prices worked out from the implied APY history, newest last.
 *
 * The line goes back only as far as maturity is ahead. With equal time on
 * both sides of Today the price keeps one slope through it; a longer past
 * climbs faster than the path ahead and weighs the chart to the left.
 *
 * The series is scaled so its newest point equals today's price: the server's
 * price and the APY-derived one can differ slightly, and the line has to meet
 * the Today dot.
 */
export function buildPastPrices({
  history,
  maturityTime,
  currentRate,
  now,
}: {
  history?: IPtChartApyPoint[] | null;
  maturityTime: number;
  currentRate: number;
  now: number;
}): IPtPastPrices {
  const none: IPtPastPrices = { points: [], stepMs: DAY_MS };
  const points = (history ?? [])
    .map((item) => ({
      time: Number(item.timestamp),
      apy: parseApyPercent(item.apy),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.time) &&
        Number.isFinite(item.apy) &&
        item.apy > -100 &&
        item.time < maturityTime &&
        item.time <= now,
    )
    .toSorted((a, b) => a.time - b.time);
  const newest = points[points.length - 1];
  if (
    points.length < 2 ||
    !(currentRate > 0) ||
    now - newest.time > MAX_HISTORY_STALENESS_MS
  ) {
    return none;
  }

  const startTime = now - Math.min(now - points[0].time, maturityTime - now);
  const stepMs = getSampleStep(now - startTime);
  // Count back from the newest point so the latest value is always kept.
  const sampled: typeof points = [];
  let nextTime = newest.time;
  for (
    let index = points.length - 1;
    index >= 0 && points[index].time >= startTime;
    index -= 1
  ) {
    if (points[index].time <= nextTime) {
      sampled.push(points[index]);
      nextTime = points[index].time - stepMs;
    }
  }
  sampled.reverse();
  if (sampled.length < 2) {
    return none;
  }

  const prices = sampled.map((item) => ({
    time: item.time,
    price: getPtPriceFromImpliedApy({
      apyPercent: item.apy,
      daysToMaturity: (maturityTime - item.time) / DAY_MS,
    }),
  }));
  const pin = currentRate / prices[prices.length - 1].price;
  if (!Number.isFinite(pin) || Math.abs(pin - 1) > MAX_PIN_DEVIATION) {
    return none;
  }
  return {
    points: prices.map((item) => ({
      time: item.time,
      price: item.price * pin,
    })),
    stepMs,
  };
}

/**
 * Price on the way to maturity if today's rate holds: today's price compounds
 * to the redemption value at the maturity time.
 */
export function getFuturePrice({
  time,
  now,
  maturityTime,
  currentRate,
  targetRate,
}: {
  time: number;
  now: number;
  maturityTime: number;
  currentRate: number;
  targetRate: number;
}): number {
  const span = maturityTime - now;
  if (!(span > 0) || !(currentRate > 0) || !(targetRate > 0)) {
    return currentRate;
  }
  const progress = Math.min(Math.max((time - now) / span, 0), 1);
  return currentRate * (targetRate / currentRate) ** progress;
}

export function buildFuturePrices({
  now,
  maturityTime,
  currentRate,
  targetRate,
  maxSteps = 60,
}: {
  now: number;
  maturityTime: number;
  currentRate: number;
  targetRate: number;
  maxSteps?: number;
}): IPtPricePoint[] {
  const span = maturityTime - now;
  if (!(span > 0)) {
    return [];
  }
  const steps = Math.max(1, Math.min(maxSteps, Math.ceil(span / DAY_MS)));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const time = index === steps ? maturityTime : now + (span * index) / steps;
    return {
      time,
      price: getFuturePrice({
        time,
        now,
        maturityTime,
        currentRate,
        targetRate,
      }),
    };
  });
}

export type IPtTimeScale = {
  x: (time: number) => number;
  time: (x: number) => number;
};

/** One even time axis from the first point to maturity. */
export function createTimeScale({
  startTime,
  maturityTime,
  left,
  right,
}: {
  startTime: number;
  maturityTime: number;
  left: number;
  right: number;
}): IPtTimeScale {
  const span = Math.max(maturityTime - startTime, 1);
  const width = right - left;
  return {
    x: (time) => left + ((time - startTime) / span) * width,
    time: (x) =>
      startTime +
      Math.min(Math.max((x - left) / Math.max(width, 1), 0), 1) * span,
  };
}

export type IPtPriceDomain = { min: number; max: number };

export function getPriceDomain(prices: number[]): IPtPriceDomain {
  const finite = prices.filter((price) => Number.isFinite(price));
  if (!finite.length) {
    return { min: 0, max: 1 };
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || Math.max(Math.abs(max) * 0.001, 1e-6);
  // Room under the line for the fill, a little over 1 for the end marker.
  return { min: min - range * 0.14, max: max + range * 0.04 };
}

/**
 * Lowers the bottom of the domain until `price` sits at least `share` of the
 * height above it, so a label hung under that point stays inside the chart.
 */
export function keepRoomBelow({
  domain,
  price,
  share,
}: {
  domain: IPtPriceDomain;
  price: number;
  share: number;
}): IPtPriceDomain {
  if (!(share > 0) || share >= 1) {
    return domain;
  }
  return {
    min: Math.min(domain.min, (price - share * domain.max) / (1 - share)),
    max: domain.max,
  };
}

/** Index of the point closest in time, for points sorted by time. */
export function findNearestPointIndex(
  points: IPtPricePoint[],
  time: number,
): number {
  if (!points.length) {
    return -1;
  }
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].time <= time) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.abs(points[high].time - time) < Math.abs(points[low].time - time)
    ? high
    : low;
}

/**
 * Whole steps from today, so the card reads one price per step. Maturity
 * rarely falls on a step, so the cursor can stop there too.
 */
export function snapToStep({
  time,
  now,
  maturityTime,
  stepMs,
}: {
  time: number;
  now: number;
  maturityTime: number;
  stepMs: number;
}): number {
  const snapped = Math.min(
    Math.max(now + Math.round((time - now) / stepMs) * stepMs, now),
    maturityTime,
  );
  return Math.abs(maturityTime - time) < Math.abs(time - snapped)
    ? maturityTime
    : snapped;
}

export function formatPtRate(rate: number): string {
  if (!Number.isFinite(rate)) {
    return '--';
  }
  return Number(rate.toFixed(4)).toString();
}

export function buildLinePath(points: Array<[number, number]>): string {
  return points
    .map(
      ([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`,
    )
    .join(' ');
}
