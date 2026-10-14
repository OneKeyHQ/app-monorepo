export type IApyChartHistoryItem = {
  timestamp: number;
  /** Absent on a point the series has no value for: a gap in the line. */
  apy?: string;
};

export type IApyChartTimePeriod = '1h' | '1d' | '1w' | 'max';

type IChartPoint = { timestamp: number };
type INormalizedApyHistoryItem = { timestamp: number; apy: number };
/** A null apy is a gap: the line breaks there. */
export type IApyChartGapPoint = { timestamp: number; apy: number | null };

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

function normalizeHistoryWithGaps(
  history?: IApyChartHistoryItem[] | null,
): IApyChartGapPoint[] {
  if (!history?.length) {
    return [];
  }

  return history
    .map((item) => {
      const apy = Number(item.apy);
      return {
        timestamp: Number(item.timestamp),
        apy: Number.isFinite(apy) ? apy : null,
      };
    })
    .filter((item) => Number.isFinite(item.timestamp))
    .toSorted((a, b) => a.timestamp - b.timestamp);
}

function normalizeHistory(
  history?: IApyChartHistoryItem[] | null,
): INormalizedApyHistoryItem[] {
  return normalizeHistoryWithGaps(history).filter(
    (item): item is INormalizedApyHistoryItem => item.apy !== null,
  );
}

/** Newest point of a series, the anchor the other line's window is cut from. */
export function getLatestTimestamp(
  history?: IApyChartHistoryItem[] | null,
): number | undefined {
  const normalized = normalizeHistory(history);
  return normalized.length
    ? normalized[normalized.length - 1].timestamp
    : undefined;
}

function toUtcDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function toUtcWeekKey(timestamp: number) {
  const date = new Date(timestamp);
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return utcDate.getTime().toString();
}

function aggregateByPeriod<T extends IChartPoint>(
  history: T[],
  period: '1d' | '1w',
): T[] {
  const bucket = new Map<string, T>();

  history.forEach((item) => {
    const key =
      period === '1d'
        ? toUtcDateKey(item.timestamp)
        : toUtcWeekKey(item.timestamp);
    bucket.set(key, item);
  });

  return Array.from(bucket.values()).toSorted(
    (a, b) => a.timestamp - b.timestamp,
  );
}

function filterByTimeWindow<T extends IChartPoint>(
  history: T[],
  windowMs: number,
  anchorTimestamp?: number,
): T[] {
  if (!history.length) {
    return [];
  }

  // The window ends at the anchor when one is given and starts windowMs
  // before it. The second line is cut from the primary line's newest point, so
  // a campaign or reward line whose data stops earlier shows its tail inside
  // the same days as the base line instead of being shifted to its own last
  // week, and a point newer than the base line is left out rather than drawn
  // past it (OK-62946). Without an anchor the upper bound is the series' own
  // newest point, so it never removes anything.
  const latestTimestamp =
    anchorTimestamp ?? history[history.length - 1].timestamp;
  const minTimestamp = latestTimestamp - windowMs;
  return history.filter(
    (item) =>
      item.timestamp >= minTimestamp && item.timestamp <= latestTimestamp,
  );
}

function windowByPeriod<T extends IChartPoint>(
  normalized: T[],
  period: IApyChartTimePeriod,
  anchorTimestamp?: number,
): T[] {
  if (!normalized.length) {
    return [];
  }

  if (period === '1h') {
    return filterByTimeWindow(normalized, SEVEN_DAYS_MS, anchorTimestamp);
  }

  if (period === '1d') {
    return filterByTimeWindow(
      aggregateByPeriod(normalized, '1d'),
      THIRTY_DAYS_MS,
      anchorTimestamp,
    );
  }

  if (period === '1w') {
    return filterByTimeWindow(
      aggregateByPeriod(normalized, '1w'),
      ONE_YEAR_MS,
      anchorTimestamp,
    );
  }

  return normalized;
}

export function buildChartHistory(
  history: IApyChartHistoryItem[] | null | undefined,
  period: IApyChartTimePeriod,
  anchorTimestamp?: number,
): INormalizedApyHistoryItem[] {
  return windowByPeriod(normalizeHistory(history), period, anchorTimestamp);
}

/**
 * buildChartHistory for a line that may stop and resume, such as a campaign
 * that ran in August and again in October: points without a value stay as
 * gaps, so the chart breaks the line there instead of drawing one straight
 * segment across the weeks in between. The daily and weekly buckets keep the
 * same last-point-of-the-bucket rule, so both lines sample the same moments.
 */
export function buildChartHistoryWithGaps(
  history: IApyChartHistoryItem[] | null | undefined,
  period: IApyChartTimePeriod,
  anchorTimestamp?: number,
): IApyChartGapPoint[] {
  return windowByPeriod(
    normalizeHistoryWithGaps(history),
    period,
    anchorTimestamp,
  );
}
