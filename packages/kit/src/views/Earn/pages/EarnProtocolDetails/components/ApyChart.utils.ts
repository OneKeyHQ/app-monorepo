export type IApyChartHistoryItem = {
  timestamp: number;
  apy: string;
};

export type IApyChartTimePeriod = '1h' | '1d' | '1w' | 'max';

type INormalizedApyHistoryItem = { timestamp: number; apy: number };

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

function normalizeHistory(
  history?: IApyChartHistoryItem[] | null,
): INormalizedApyHistoryItem[] {
  if (!history?.length) {
    return [];
  }

  return history
    .map((item) => ({
      timestamp: Number(item.timestamp),
      apy: Number(item.apy),
    }))
    .filter(
      (item) => Number.isFinite(item.timestamp) && Number.isFinite(item.apy),
    )
    .toSorted((a, b) => a.timestamp - b.timestamp);
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

function aggregateByPeriod(
  history: INormalizedApyHistoryItem[],
  period: '1d' | '1w',
) {
  const bucket = new Map<string, INormalizedApyHistoryItem>();

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

function filterByTimeWindow(
  history: INormalizedApyHistoryItem[],
  windowMs: number,
  anchorTimestamp?: number,
) {
  if (!history.length) {
    return [];
  }

  // The window ends at the anchor when one is given. The second line is cut
  // from the primary line's newest point, so a campaign or reward line whose
  // data stops earlier shows its tail inside the same days as the base line
  // instead of being shifted to its own last week (OK-62946).
  const latestTimestamp =
    anchorTimestamp ?? history[history.length - 1].timestamp;
  const minTimestamp = latestTimestamp - windowMs;
  return history.filter((item) => item.timestamp >= minTimestamp);
}

export function buildChartHistory(
  history: IApyChartHistoryItem[] | null | undefined,
  period: IApyChartTimePeriod,
  anchorTimestamp?: number,
) {
  const normalized = normalizeHistory(history);

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
