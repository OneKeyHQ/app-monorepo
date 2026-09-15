/**
 * Client availability aggregator.
 *
 * Request, connection and user-flow outcomes are counted in memory and
 * reported as aggregated `availabilitySnapshot` analytics events. Sends are
 * paced (at most one per AVAILABILITY_MIN_SEND_GAP_MS) and hard-capped per
 * UTC day, so analytics volume never scales with request volume, reconnect
 * storms, polling loops or visibility churn.
 *
 * Runtime scope: one aggregator per JS runtime. On iOS/Android/extension the
 * main (UI) and background runtimes keep independent counters, budgets and
 * persisted state under runtime-specific async storage keys (native storage
 * is a shared native instance underneath, so keys must never be shared
 * between runtimes). Desktop and web run a single `standalone` runtime.
 * State is hydrated asynchronously; nothing is sent or persisted before
 * hydration completes, so a cold start can never reset the daily budget.
 */
import appGlobals from '../appGlobals';
import { defaultLogger } from '../logger/logger';
import { loggerConfig } from '../logger/loggerConfig';
import platformEnv, { ERuntimeRole } from '../platformEnv';
import appStorage from '../storage/appStorage';
import { onVisibilityStateChange } from '../utils/appVisibility';
import { generateUUID } from '../utils/miscUtils';
import { trackedSetInterval } from '../utils/timerRegistry';

import type { IAvailabilitySnapshotParams } from '../logger/scopes/app/types';

export type IAvailabilitySource =
  | 'api'
  // API outcome breakdowns by context; they never carry failure details.
  | 'api_ip_table'
  | 'api_net'
  | 'api_proxy'
  | 'api_route'
  | 'flow'
  | 'sni'
  | 'webview'
  | 'ws_close'
  | 'ws_connect';

export type IAvailabilityFlow =
  | 'camera_permission'
  | 'cloud_backup'
  | 'cloud_restore'
  | 'hw_connect'
  | 'hw_search'
  | 'prime_login_email'
  | 'prime_login_oauth'
  | 'qr_camera'
  | 'qr_library'
  | 'send';

export type IAvailabilityStatus =
  // Shared outcomes
  | 'ok'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  // API
  | 'api_error'
  | 'http_error'
  | 'network_error'
  // IP Table / SNI
  | 'fallback_ok'
  | 'fallback_failed'
  | 'blocked'
  | 'fail_closed'
  // WebView
  | 'render_process_gone'
  // WebSocket close reasons
  | 'client_disconnect'
  | 'server_disconnect'
  | 'ping_timeout'
  | 'transport_close'
  | 'transport_error'
  | 'unknown'
  // Flows
  | 'started'
  | 'unfinished'
  | 'submitted'
  | 'signed'
  | 'partial'
  | 'found'
  | 'empty'
  | 'no_code'
  | 'existing_grant'
  | 'request_grant'
  | 'denied'
  | 'error';

export type IAvailabilityOutcome = {
  source: IAvailabilitySource;
  /** Low-cardinality group: service, transport or flow name. */
  target: string;
  status: IAvailabilityStatus;
  durationMs?: number;
  /** Sub-dimension kept only in failure details (route group, trigger...). */
  detail?: string;
  /** Normalized stable error code, kept only in failure details. */
  errorCode?: string;
};

export type IAvailabilityFlowResult = {
  status: IAvailabilityStatus;
  detail?: string;
  errorCode?: string;
};

export type IAvailabilityFlowHandle = {
  /** Idempotent: only the first call records an outcome. */
  finish: (result: IAvailabilityFlowResult) => void;
};

export type IAvailabilityFlushReason = 'hidden' | 'interval' | 'startup';

export const AVAILABILITY_SNAPSHOT_SCHEMA_VERSION = 1;
export const AVAILABILITY_MAX_SNAPSHOTS_PER_DAY = 12;
/** Pacing: 24h / daily budget, so an always-on client spreads its sends. */
export const AVAILABILITY_MIN_SEND_GAP_MS = 2 * 60 * 60 * 1000;
export const AVAILABILITY_FLUSH_CHECK_INTERVAL_MS = 30 * 60 * 1000;
export const AVAILABILITY_STARTUP_FLUSH_DELAY_MS = 60 * 1000;
export const AVAILABILITY_WINDOWS_PERSIST_DEBOUNCE_MS = 5 * 60 * 1000;
export const AVAILABILITY_MAX_SERIES_PER_WINDOW = 200;
/** Separate cap so API context breakdowns never displace primary series. */
export const AVAILABILITY_MAX_BREAKDOWN_SERIES_PER_WINDOW = 80;
export const AVAILABILITY_MAX_FAILURE_KEYS_PER_WINDOW = 50;
export const AVAILABILITY_MAX_GROUPS = 40;
/**
 * Upper bound for counter/group properties in one event. Together with the
 * meta, failure and analytics device properties this stays below the 255
 * properties per event accepted by Mixpanel.
 */
export const AVAILABILITY_MAX_METRIC_PROPS = 200;
export const AVAILABILITY_FAILURE_TEXT_PROPS = 4;
/** Mixpanel truncates string properties longer than 255 characters. */
export const AVAILABILITY_FAILURE_TEXT_MAX_LENGTH = 255;
export const AVAILABILITY_MAX_PERSISTED_WINDOWS_LENGTH = 64 * 1024;
const AVAILABILITY_SEND_READY_TIMEOUT_MS = 3000;
const AVAILABILITY_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
const AVAILABILITY_MAX_INFLIGHT_PER_FLOW = 100;

// Upper bounds of the duration histogram; the final bucket is open-ended.
const DURATION_BUCKET_UPPER_BOUNDS_MS = [
  100, 300, 1000, 3000, 10_000, 30_000, 60_000,
];
const DURATION_BUCKET_COUNT = DURATION_BUCKET_UPPER_BOUNDS_MS.length + 1;

const SLOW_THRESHOLD_MS: Partial<Record<IAvailabilitySource, number>> = {
  api: 3000,
  api_route: 3000,
  sni: 3000,
  webview: 10_000,
  ws_connect: 5000,
};

// Breakdown sources repeat API outcomes, whose failure details already exist.
const SOURCES_WITHOUT_FAILURE_DETAIL = new Set<IAvailabilitySource>([
  'api_ip_table',
  'api_net',
  'api_proxy',
  'api_route',
]);

// Outcomes that are not failures carry no failure-detail entry.
const STATUSES_WITHOUT_FAILURE_DETAIL = new Set<IAvailabilityStatus>([
  'cancelled',
  'client_disconnect',
  'empty',
  'existing_grant',
  'found',
  'no_code',
  'ok',
  'request_grant',
  'signed',
  'started',
  'submitted',
  'unfinished',
]);

type IAvailabilitySeries = {
  count: number;
  slowCount: number;
  maxMs: number;
  buckets: number[];
};

export type IAvailabilityWindow = {
  id: string;
  startTs: number;
  endTs: number;
  mergedWindows: number;
  /** Keyed by `${source}|${target}|${status}`. */
  series: Record<string, IAvailabilitySeries>;
  seriesOverflow: number;
  /** Keyed by `${source}|${target}|${status}|${detail}|${errorCode}`. */
  failures: Record<string, number>;
  failuresOverflow: number;
  breakdownSeriesOverflow: number;
  /** Set once sent under `id`; the window is then resent only unchanged. */
  attempted?: boolean;
};

/** Small, frequently written record: spend, pacing and in-flight flows. */
export type IAvailabilityBudgetState = {
  version: 1;
  budgetDay: string;
  budgetUsed: number;
  lastAttemptTs: number;
  inflight?: Partial<Record<IAvailabilityFlow, number>>;
};

/** Counter windows, written on a slow debounce and around sends. */
export type IAvailabilityWindowsState = {
  version: 1;
  current?: IAvailabilityWindow;
  pending?: IAvailabilityWindow;
};

type ITimerId = ReturnType<typeof setTimeout>;

export type IAvailabilityScheduler = {
  setInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  setTimeout: (fn: () => void, ms: number) => ITimerId;
};

export type IAvailabilityStorage = {
  loadBudget: () => Promise<unknown>;
  saveBudget: (state: IAvailabilityBudgetState) => Promise<void>;
  loadWindows: () => Promise<unknown>;
  saveWindows: (state: IAvailabilityWindowsState) => Promise<void>;
};

export type IAvailabilityAggregatorDeps = {
  now: () => number;
  createId: () => string;
  /**
   * Whether counter windows and in-flight flows are persisted. Only
   * single-instance runtimes may persist them: web tabs and extension UI
   * pages share one storage key, so recovering another live instance's
   * window would double count. The shared budget is persisted everywhere.
   */
  persistWindows: boolean;
  storage: IAvailabilityStorage;
  /** Undefined disables every timer (tests). */
  scheduler?: IAvailabilityScheduler;
  subscribeVisibility?: (callback: (visible: boolean) => void) => () => void;
  canSend: () => Promise<boolean>;
  send: (params: IAvailabilitySnapshotParams) => Promise<void>;
  /**
   * Multi-instance runtimes only: runs the shared budget check-and-spend
   * exclusively across tabs/pages. Omitted where no cross-instance lock exists.
   */
  withSharedBudgetLock?: (task: () => Promise<boolean>) => Promise<boolean>;
};

function getUtcDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeAvailabilityToken(value: unknown) {
  const token = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return token || 'other';
}

function normalizeDetail(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const detail = String(value).toLowerCase();
  return /^[a-z0-9_./:-]{1,128}$/.test(detail) ? detail : 'other';
}

function normalizeErrorToken(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const errorCode = String(value).toLowerCase();
  return /^[a-z0-9_-]{1,64}$/.test(errorCode) ? errorCode : 'unknown';
}

function getDurationBucketIndex(durationMs: number) {
  const index = DURATION_BUCKET_UPPER_BOUNDS_MS.findIndex(
    (upperBound) => durationMs <= upperBound,
  );
  return index === -1 ? DURATION_BUCKET_COUNT - 1 : index;
}

function createEmptyBuckets() {
  return Array.from({ length: DURATION_BUCKET_COUNT }, () => 0);
}

export function createAvailabilityWindow({
  id,
  now,
}: {
  id: string;
  now: number;
}): IAvailabilityWindow {
  return {
    id,
    startTs: now,
    endTs: now,
    mergedWindows: 1,
    series: {},
    seriesOverflow: 0,
    failures: {},
    failuresOverflow: 0,
    breakdownSeriesOverflow: 0,
  };
}

function isBreakdownSeriesKey(seriesKey: string) {
  return SOURCES_WITHOUT_FAILURE_DETAIL.has(
    seriesKey.slice(0, seriesKey.indexOf('|')) as IAvailabilitySource,
  );
}

/** Whether a new series of this kind fits under its own per-window cap. */
function hasSeriesCapacity(window: IAvailabilityWindow, breakdown: boolean) {
  let used = 0;
  for (const seriesKey of Object.keys(window.series)) {
    if (isBreakdownSeriesKey(seriesKey) === breakdown) {
      used += 1;
    }
  }
  return (
    used <
    (breakdown
      ? AVAILABILITY_MAX_BREAKDOWN_SERIES_PER_WINDOW
      : AVAILABILITY_MAX_SERIES_PER_WINDOW)
  );
}

function addSeriesOverflow(
  window: IAvailabilityWindow,
  breakdown: boolean,
  count: number,
) {
  if (breakdown) {
    window.breakdownSeriesOverflow += count;
  } else {
    window.seriesOverflow += count;
  }
}

function hasWindowData(
  window: IAvailabilityWindow | undefined,
): window is IAvailabilityWindow {
  return (
    !!window &&
    (Object.keys(window.series).length > 0 ||
      window.seriesOverflow > 0 ||
      window.failuresOverflow > 0)
  );
}

function addFailureCount(
  window: IAvailabilityWindow,
  failureKey: string,
  count: number,
) {
  if (window.failures[failureKey] !== undefined) {
    window.failures[failureKey] += count;
  } else if (
    Object.keys(window.failures).length <
    AVAILABILITY_MAX_FAILURE_KEYS_PER_WINDOW
  ) {
    window.failures[failureKey] = count;
  } else {
    window.failuresOverflow += count;
  }
}

export function addAvailabilityOutcome(
  window: IAvailabilityWindow,
  outcome: IAvailabilityOutcome,
  count = 1,
) {
  const target = normalizeAvailabilityToken(outcome.target);
  const seriesKey = `${outcome.source}|${target}|${outcome.status}`;
  let series = window.series[seriesKey];
  if (!series) {
    const breakdown = SOURCES_WITHOUT_FAILURE_DETAIL.has(outcome.source);
    if (!hasSeriesCapacity(window, breakdown)) {
      addSeriesOverflow(window, breakdown, count);
      return;
    }
    series = {
      count: 0,
      slowCount: 0,
      maxMs: 0,
      buckets: createEmptyBuckets(),
    };
    window.series[seriesKey] = series;
  }
  series.count += count;

  if (count === 1 && isNonNegativeNumber(outcome.durationMs)) {
    const durationMs = Math.round(outcome.durationMs);
    series.buckets[getDurationBucketIndex(durationMs)] += 1;
    series.maxMs = Math.max(series.maxMs, durationMs);
    const slowThresholdMs = SLOW_THRESHOLD_MS[outcome.source];
    if (slowThresholdMs !== undefined && durationMs >= slowThresholdMs) {
      series.slowCount += 1;
    }
  }

  if (
    !STATUSES_WITHOUT_FAILURE_DETAIL.has(outcome.status) &&
    !SOURCES_WITHOUT_FAILURE_DETAIL.has(outcome.source)
  ) {
    addFailureCount(
      window,
      [
        outcome.source,
        target,
        outcome.status,
        normalizeDetail(outcome.detail),
        normalizeErrorToken(outcome.errorCode),
      ].join('|'),
      count,
    );
  }
}

/** Merges `source` into `target` in place and returns `target`. */
export function mergeAvailabilityWindows(
  target: IAvailabilityWindow,
  source: IAvailabilityWindow,
) {
  target.startTs = Math.min(target.startTs, source.startTs);
  target.endTs = Math.max(target.endTs, source.endTs);
  target.mergedWindows += source.mergedWindows;
  target.seriesOverflow += source.seriesOverflow;
  target.failuresOverflow += source.failuresOverflow;
  target.breakdownSeriesOverflow += source.breakdownSeriesOverflow;

  for (const [seriesKey, series] of Object.entries(source.series)) {
    const existing = target.series[seriesKey];
    if (existing) {
      existing.count += series.count;
      existing.slowCount += series.slowCount;
      existing.maxMs = Math.max(existing.maxMs, series.maxMs);
      existing.buckets = existing.buckets.map(
        (bucketCount, index) => bucketCount + (series.buckets[index] ?? 0),
      );
    } else if (hasSeriesCapacity(target, isBreakdownSeriesKey(seriesKey))) {
      target.series[seriesKey] = {
        ...series,
        buckets: [...series.buckets],
      };
    } else {
      addSeriesOverflow(target, isBreakdownSeriesKey(seriesKey), series.count);
    }
  }

  for (const [failureKey, count] of Object.entries(source.failures)) {
    addFailureCount(target, failureKey, count);
  }
  return target;
}

function computeP95Ms(buckets: number[], maxMs: number) {
  const timedCount = buckets.reduce((sum, count) => sum + count, 0);
  if (timedCount === 0) {
    return undefined;
  }
  const rank = Math.ceil(timedCount * 0.95);
  let cumulative = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    cumulative += buckets[index];
    if (cumulative >= rank) {
      const upperBound = DURATION_BUCKET_UPPER_BOUNDS_MS[index];
      return upperBound === undefined ? maxMs : Math.min(upperBound, maxMs);
    }
  }
  return maxMs;
}

/**
 * Flattens one window into event properties that product analytics can sum
 * across clients:
 * - `${source}_${target}_n`: outcomes excluding flow `started`
 * - `${source}_${target}_${status}`: outcome counts
 * - `${source}_${target}_p95_ms`: bucketed client-side p95
 * - `${source}_${target}_slow`: count above the source slow threshold
 * - `failures_1..N`: top failure details `source|target|status|detail|code=n`
 * Metric properties share one budget; `_n` totals are kept first.
 */
export function buildAvailabilitySnapshotParams(
  window: IAvailabilityWindow,
): IAvailabilitySnapshotParams {
  const params: IAvailabilitySnapshotParams = {
    schemaVersion: AVAILABILITY_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: window.id,
    windowStartTs: window.startTs,
    windowEndTs: window.endTs,
    windowCount: window.mergedWindows,
  };

  type IGroup = {
    prefix: string;
    source: IAvailabilitySource;
    total: number;
    slowCount: number;
    maxMs: number;
    buckets: number[];
  };
  const groups = new Map<string, IGroup>();
  const sortedSeries = Object.entries(window.series)
    .map(([seriesKey, series]) => {
      const [source, target, status] = seriesKey.split('|') as [
        IAvailabilitySource,
        string,
        IAvailabilityStatus,
      ];
      return { prefix: `${source}_${target}`, source, status, series };
    })
    .toSorted((a, b) => b.series.count - a.series.count);

  for (const { prefix, source, status, series } of sortedSeries) {
    if (status !== 'started') {
      let group = groups.get(prefix);
      if (!group) {
        group = {
          prefix,
          source,
          total: 0,
          slowCount: 0,
          maxMs: 0,
          buckets: createEmptyBuckets(),
        };
        groups.set(prefix, group);
      }
      group.total += series.count;
      group.slowCount += series.slowCount;
      group.maxMs = Math.max(group.maxMs, series.maxMs);
      group.buckets = group.buckets.map(
        (bucketCount, index) => bucketCount + (series.buckets[index] ?? 0),
      );
    }
  }

  let metricProps = 0;
  const addMetricProp = (key: string, value: number) => {
    if (metricProps >= AVAILABILITY_MAX_METRIC_PROPS) {
      return false;
    }
    params[key] = value;
    metricProps += 1;
    return true;
  };

  // The budget is spent in two full passes: primary sources (per service,
  // transport, flow) first, then the API context breakdowns, whose totals
  // repeat API outcomes. Breakdowns can therefore never push a primary
  // total, status, p95 or slow count out of the property budget.
  const isBreakdownSource = (source: IAvailabilitySource) =>
    SOURCES_WITHOUT_FAILURE_DETAIL.has(source);
  const rankedGroups = [...groups.values()].toSorted(
    (a, b) => b.total - a.total,
  );
  let remainingGroupSlots = AVAILABILITY_MAX_GROUPS;
  let groupsTruncated = 0;
  const emitPartition = (breakdown: boolean) => {
    const partitionGroups = rankedGroups.filter(
      (group) => isBreakdownSource(group.source) === breakdown,
    );
    const selectedGroups = partitionGroups.slice(0, remainingGroupSlots);
    remainingGroupSlots -= selectedGroups.length;
    groupsTruncated += partitionGroups.length - selectedGroups.length;
    const selectedPrefixes = new Set(
      selectedGroups.map(({ prefix }) => prefix),
    );
    let truncated = 0;
    for (const group of selectedGroups) {
      addMetricProp(`${group.prefix}_n`, group.total);
    }
    const partitionSeries = sortedSeries.filter(
      ({ source }) => isBreakdownSource(source) === breakdown,
    );
    for (const { prefix, status, series } of partitionSeries) {
      // A breakdown series without its total is not interpretable.
      if (
        (breakdown && !selectedPrefixes.has(prefix)) ||
        !addMetricProp(`${prefix}_${status}`, series.count)
      ) {
        truncated += series.count;
      }
    }
    for (const group of selectedGroups) {
      const p95Ms = computeP95Ms(group.buckets, group.maxMs);
      if (p95Ms !== undefined) {
        addMetricProp(`${group.prefix}_p95_ms`, p95Ms);
      }
      if (SLOW_THRESHOLD_MS[group.source] !== undefined) {
        addMetricProp(`${group.prefix}_slow`, group.slowCount);
      }
    }
    return truncated;
  };
  const seriesTruncated = window.seriesOverflow + emitPartition(false);
  const breakdownSeriesTruncated =
    window.breakdownSeriesOverflow + emitPartition(true);
  if (groupsTruncated > 0) {
    params.groupsTruncated = groupsTruncated;
  }
  if (seriesTruncated > 0) {
    params.seriesTruncated = seriesTruncated;
  }
  if (breakdownSeriesTruncated > 0) {
    params.breakdownSeriesTruncated = breakdownSeriesTruncated;
  }

  const sortedFailures = Object.entries(window.failures).toSorted(
    (a, b) => b[1] - a[1],
  );
  const failureTexts: string[] = [];
  let failuresOmitted = window.failuresOverflow;
  for (const [failureKey, count] of sortedFailures) {
    const part = `${failureKey}=${count}`;
    const lastIndex = failureTexts.length - 1;
    if (
      lastIndex >= 0 &&
      failureTexts[lastIndex].length + 1 + part.length <=
        AVAILABILITY_FAILURE_TEXT_MAX_LENGTH
    ) {
      failureTexts[lastIndex] = `${failureTexts[lastIndex]},${part}`;
    } else if (
      failureTexts.length < AVAILABILITY_FAILURE_TEXT_PROPS &&
      part.length <= AVAILABILITY_FAILURE_TEXT_MAX_LENGTH
    ) {
      failureTexts.push(part);
    } else {
      failuresOmitted += count;
    }
  }
  failureTexts.forEach((text, index) => {
    params[`failures_${index + 1}`] = text;
  });
  if (failuresOmitted > 0) {
    params.failuresOmitted = failuresOmitted;
  }
  return params;
}

function sanitizeSeries(value: unknown): IAvailabilitySeries | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const series = value as Partial<IAvailabilitySeries>;
  if (
    !isNonNegativeNumber(series.count) ||
    !isNonNegativeNumber(series.slowCount) ||
    !isNonNegativeNumber(series.maxMs) ||
    !Array.isArray(series.buckets) ||
    series.buckets.length !== DURATION_BUCKET_COUNT ||
    !series.buckets.every(isNonNegativeNumber)
  ) {
    return undefined;
  }
  return {
    count: series.count,
    slowCount: series.slowCount,
    maxMs: series.maxMs,
    buckets: [...series.buckets],
  };
}

function sanitizeWindow(value: unknown): IAvailabilityWindow | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const window = value as Partial<IAvailabilityWindow>;
  if (
    typeof window.id !== 'string' ||
    !isNonNegativeNumber(window.startTs) ||
    !isNonNegativeNumber(window.endTs) ||
    !isNonNegativeNumber(window.mergedWindows) ||
    !isNonNegativeNumber(window.seriesOverflow) ||
    !isNonNegativeNumber(window.failuresOverflow) ||
    !window.series ||
    typeof window.series !== 'object' ||
    !window.failures ||
    typeof window.failures !== 'object'
  ) {
    return undefined;
  }
  const sanitized = createAvailabilityWindow({
    id: window.id,
    now: window.startTs,
  });
  sanitized.endTs = window.endTs;
  sanitized.mergedWindows = Math.max(1, window.mergedWindows);
  sanitized.seriesOverflow = window.seriesOverflow;
  sanitized.failuresOverflow = window.failuresOverflow;
  sanitized.breakdownSeriesOverflow = isNonNegativeNumber(
    window.breakdownSeriesOverflow,
  )
    ? window.breakdownSeriesOverflow
    : 0;
  if (window.attempted === true) {
    sanitized.attempted = true;
  }
  for (const [seriesKey, series] of Object.entries(window.series).slice(
    0,
    AVAILABILITY_MAX_SERIES_PER_WINDOW +
      AVAILABILITY_MAX_BREAKDOWN_SERIES_PER_WINDOW,
  )) {
    const sanitizedSeries = sanitizeSeries(series);
    if (sanitizedSeries && seriesKey.split('|').length === 3) {
      sanitized.series[seriesKey] = sanitizedSeries;
    }
  }
  for (const [failureKey, count] of Object.entries(window.failures).slice(
    0,
    AVAILABILITY_MAX_FAILURE_KEYS_PER_WINDOW,
  )) {
    if (isNonNegativeNumber(count) && failureKey.split('|').length === 5) {
      sanitized.failures[failureKey] = count;
    }
  }
  return sanitized;
}

export function sanitizeAvailabilityBudgetState(
  value: unknown,
): IAvailabilityBudgetState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Partial<IAvailabilityBudgetState>;
  if (
    state.version !== 1 ||
    typeof state.budgetDay !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(state.budgetDay) ||
    !isNonNegativeNumber(state.budgetUsed) ||
    !isNonNegativeNumber(state.lastAttemptTs)
  ) {
    return undefined;
  }
  const sanitized: IAvailabilityBudgetState = {
    version: 1,
    budgetDay: state.budgetDay,
    budgetUsed: state.budgetUsed,
    lastAttemptTs: state.lastAttemptTs,
  };
  if (state.inflight && typeof state.inflight === 'object') {
    sanitized.inflight = {};
    for (const [flow, count] of Object.entries(state.inflight)) {
      if (isNonNegativeNumber(count) && count > 0) {
        sanitized.inflight[flow as IAvailabilityFlow] = Math.min(
          count,
          AVAILABILITY_MAX_INFLIGHT_PER_FLOW,
        );
      }
    }
  }
  return sanitized;
}

export function sanitizeAvailabilityWindowsState(
  value: unknown,
): IAvailabilityWindowsState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Partial<IAvailabilityWindowsState>;
  if (state.version !== 1) {
    return undefined;
  }
  return {
    version: 1,
    current: sanitizeWindow(state.current),
    pending: sanitizeWindow(state.pending),
  };
}

export class AvailabilityAggregator {
  private budget: IAvailabilityBudgetState | undefined;

  private current: IAvailabilityWindow | undefined;

  private pending: IAvailabilityWindow | undefined;

  /** In-flight tracked flows of this process only. */
  private inflight: Partial<Record<IAvailabilityFlow, number>> = {};

  private hydration: Promise<void> | undefined;

  private hydrated = false;

  /**
   * A storage read failed: stored spend and windows are unknown, so nothing
   * may be written or sent until a read succeeds.
   */
  private storageReadFailed = false;

  private budgetNeedsRewrite = false;

  private flushing: Promise<void> | undefined;

  private windowsPersistTimer: ITimerId | undefined;

  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: IAvailabilityAggregatorDeps) {}

  record(outcome: IAvailabilityOutcome) {
    this.ensureStarted();
    const now = this.deps.now();
    this.current ??= createAvailabilityWindow({
      id: this.deps.createId(),
      now,
    });
    addAvailabilityOutcome(this.current, outcome);
    this.current.endTs = now;
    this.scheduleWindowsPersist();
  }

  startFlow(
    flow: IAvailabilityFlow,
    options?: { detail?: string; trackUnfinished?: boolean },
  ): IAvailabilityFlowHandle {
    const startedAt = this.deps.now();
    const trackUnfinished =
      !!options?.trackUnfinished && this.deps.persistWindows;
    this.record({
      source: 'flow',
      target: flow,
      status: 'started',
      detail: options?.detail,
    });
    if (trackUnfinished) {
      // Store 'started' before the in-flight count, so a stored in-flight
      // flow always has its start stored too.
      this.persistWindows();
      this.changeInflight(flow, 1);
    }
    let finished = false;
    return {
      finish: (result) => {
        if (finished) return;
        finished = true;
        this.record({
          source: 'flow',
          target: flow,
          status: result.status,
          durationMs: this.deps.now() - startedAt,
          detail: result.detail ?? options?.detail,
          errorCode: result.errorCode,
        });
        if (trackUnfinished) {
          this.changeInflight(flow, -1);
        }
      },
    };
  }

  flush(reason: IAvailabilityFlushReason): Promise<void> {
    this.ensureStarted();
    if (this.flushing) {
      return this.flushing;
    }
    const task = this.flushInternal(reason)
      .catch(() => undefined)
      .finally(() => {
        if (this.flushing === task) {
          this.flushing = undefined;
        }
      });
    this.flushing = task;
    return task;
  }

  /** Test-only: waits for hydration and queued writes. */
  async settleForTest() {
    this.ensureStarted();
    await this.hydration;
    await this.writeQueue;
  }

  /** Test-only view of the in-memory state. */
  getStateForTest() {
    return {
      budget: this.budget,
      current: this.current,
      pending: this.pending,
      inflight: this.inflight,
      hydrated: this.hydrated,
      storageReadFailed: this.storageReadFailed,
    };
  }

  private ensureStarted() {
    if (this.hydration) return;
    this.budget = {
      version: 1,
      budgetDay: getUtcDayKey(this.deps.now()),
      budgetUsed: 0,
      lastAttemptTs: 0,
    };
    this.hydration = this.hydrate();
    const { scheduler } = this.deps;
    if (!scheduler) return;
    scheduler.setInterval(() => {
      void this.flush('interval');
    }, AVAILABILITY_FLUSH_CHECK_INTERVAL_MS);
    try {
      this.deps.subscribeVisibility?.((visible) => {
        if (!visible) {
          void this.flush('hidden');
        }
      });
    } catch {
      // Visibility is an optimization; interval checks still run.
    }
  }

  private async hydrate() {
    await this.loadStoredState();
    this.hydrated = true;
    if (!this.storageReadFailed) {
      if (this.deps.persistWindows || this.budgetNeedsRewrite) {
        this.persistBudget();
      }
      this.persistWindows();
    }
    this.budgetNeedsRewrite = false;
    if (this.pending && this.deps.scheduler) {
      this.deps.scheduler.setTimeout(() => {
        void this.flush('startup');
      }, AVAILABILITY_STARTUP_FLUSH_DELAY_MS);
    }
  }

  /**
   * Reads stored budget and windows and merges them into memory. A rejected
   * read (unlike a missing or corrupt value) marks the state as unknown.
   */
  private async loadStoredState() {
    const { storage, persistWindows } = this.deps;
    let storedBudget: unknown;
    let storedWindows: unknown;
    try {
      [storedBudget, storedWindows] = await Promise.all([
        storage.loadBudget(),
        persistWindows ? storage.loadWindows() : Promise.resolve(undefined),
      ]);
    } catch {
      this.storageReadFailed = true;
      return;
    }
    this.storageReadFailed = false;

    const now = this.deps.now();
    const loadedBudget = sanitizeAvailabilityBudgetState(storedBudget);
    if (loadedBudget && this.adoptStoredBudget(loadedBudget, now)) {
      this.budgetNeedsRewrite = true;
    }
    if (!persistWindows) return;

    // The previous process of this single-instance runtime is gone: its
    // windows are unsent data and its in-flight flows never finished.
    const loadedWindows = sanitizeAvailabilityWindowsState(storedWindows);
    const storedPending = loadedWindows?.pending;
    const storedCurrent = loadedWindows?.current;
    if (hasWindowData(storedPending)) {
      this.pending = this.pending
        ? mergeAvailabilityWindows(this.pending, storedPending)
        : storedPending;
    }
    if (hasWindowData(storedCurrent)) {
      if (this.pending?.attempted) {
        // An attempted window is resent unchanged; newer data waits.
        this.current = this.current
          ? mergeAvailabilityWindows(this.current, storedCurrent)
          : storedCurrent;
      } else {
        this.pending = this.pending
          ? mergeAvailabilityWindows(this.pending, storedCurrent)
          : storedCurrent;
      }
    }
    const unfinished = Object.entries(loadedBudget?.inflight ?? {}) as Array<
      [IAvailabilityFlow, number]
    >;
    for (const [flow, count] of unfinished) {
      if (count > 0) {
        this.current ??= createAvailabilityWindow({
          id: this.deps.createId(),
          now,
        });
        addAvailabilityOutcome(
          this.current,
          { source: 'flow', target: flow, status: 'unfinished' },
          count,
        );
      }
    }
  }

  /**
   * Keeps the budget consistent with the current clock. A day later than
   * today (the clock moved back) keeps its spend as today's; an earlier day
   * carries no spend; a future attempt time restarts the send gap from now.
   * Returns whether anything changed.
   */
  private normalizeBudget(budget: IAvailabilityBudgetState, now: number) {
    const today = getUtcDayKey(now);
    let changed = false;
    if (budget.budgetDay > today) {
      budget.budgetDay = today;
      changed = true;
    } else if (budget.budgetDay < today) {
      budget.budgetDay = today;
      budget.budgetUsed = 0;
      changed = true;
    }
    if (budget.lastAttemptTs > now + AVAILABILITY_CLOCK_SKEW_TOLERANCE_MS) {
      budget.lastAttemptTs = now;
      changed = true;
    }
    return changed;
  }

  /**
   * Adopts the higher spend of a stored budget, normalized to `now`. Returns
   * whether the stored record is future-dated and must be rewritten as today,
   * so it expires tomorrow instead of blocking sends until that date.
   */
  private adoptStoredBudget(stored: IAvailabilityBudgetState, now: number) {
    const budget = this.getBudget();
    this.normalizeBudget(budget, now);
    const normalizedStored = { ...stored };
    const storedIsFuture = stored.budgetDay > getUtcDayKey(now);
    this.normalizeBudget(normalizedStored, now);
    budget.budgetUsed = Math.max(
      budget.budgetUsed,
      normalizedStored.budgetUsed,
    );
    budget.lastAttemptTs = Math.max(
      budget.lastAttemptTs,
      normalizedStored.lastAttemptTs,
    );
    return storedIsFuture;
  }

  private getBudget(): IAvailabilityBudgetState {
    this.budget ??= {
      version: 1,
      budgetDay: getUtcDayKey(this.deps.now()),
      budgetUsed: 0,
      lastAttemptTs: 0,
    };
    return this.budget;
  }

  private canSpend(now: number) {
    const budget = this.getBudget();
    return (
      budget.budgetUsed < AVAILABILITY_MAX_SNAPSHOTS_PER_DAY &&
      now - budget.lastAttemptTs >= AVAILABILITY_MIN_SEND_GAP_MS
    );
  }

  private async flushInternal(reason: IAvailabilityFlushReason) {
    await this.hydration;
    if (this.storageReadFailed) {
      await this.loadStoredState();
      if (this.storageReadFailed) return;
      if (this.deps.persistWindows) {
        this.persistBudget();
        this.persistWindows();
      }
    }

    const persistOnHidden = () => {
      if (reason === 'hidden') {
        this.persistWindows();
      }
    };
    const hasData = hasWindowData(this.current) || hasWindowData(this.pending);
    const now = this.deps.now();
    if (this.normalizeBudget(this.getBudget(), now)) {
      this.persistBudget();
    }
    // Cheap in-memory pre-check; reserveSend re-checks against shared state.
    if (!hasData || !this.canSpend(now) || !(await this.deps.canSend())) {
      persistOnHidden();
      return;
    }
    if (!(await this.reserveSend())) {
      persistOnHidden();
      return;
    }

    if (this.pending?.attempted !== true && hasWindowData(this.current)) {
      this.current.endTs = this.deps.now();
      this.pending = this.pending
        ? mergeAvailabilityWindows(this.pending, this.current)
        : this.current;
      this.current = undefined;
    }
    const window = this.pending;
    if (!window) return;
    // Once sent under its id, a window is only ever resent unchanged, so an
    // ambiguous failure (delivered but not acknowledged) cannot double count.
    window.attempted = true;
    this.persistWindows();
    try {
      await this.deps.send(buildAvailabilitySnapshotParams(window));
    } catch {
      return;
    }
    if (this.pending === window) {
      this.pending = undefined;
    }
    this.persistWindows();
  }

  /**
   * Spends one send from the budget before sending, so a failing endpoint is
   * paced like a success. Multi-instance runtimes re-read the shared budget
   * and commit the spend under a cross-instance lock.
   */
  private async reserveSend(): Promise<boolean> {
    const { persistWindows, storage, withSharedBudgetLock } = this.deps;
    const reserve = async () => {
      if (!persistWindows) {
        let stored: IAvailabilityBudgetState | undefined;
        try {
          stored = sanitizeAvailabilityBudgetState(await storage.loadBudget());
        } catch {
          return false;
        }
        if (stored && this.adoptStoredBudget(stored, this.deps.now())) {
          this.persistBudget();
        }
      }
      const now = this.deps.now();
      this.normalizeBudget(this.getBudget(), now);
      if (!this.canSpend(now)) {
        return false;
      }
      const budget = this.getBudget();
      budget.budgetUsed += 1;
      budget.lastAttemptTs = now;
      this.persistBudget();
      await this.writeQueue;
      return true;
    };
    if (persistWindows || !withSharedBudgetLock) {
      return reserve();
    }
    return withSharedBudgetLock(reserve);
  }

  private changeInflight(flow: IAvailabilityFlow, delta: number) {
    const next = Math.max(0, (this.inflight[flow] ?? 0) + delta);
    if (next > 0) {
      this.inflight[flow] = next;
    } else {
      delete this.inflight[flow];
    }
    this.persistBudget();
  }

  private scheduleWindowsPersist() {
    const { scheduler, persistWindows } = this.deps;
    if (!persistWindows || !scheduler || this.windowsPersistTimer) {
      return;
    }
    this.windowsPersistTimer = scheduler.setTimeout(() => {
      this.windowsPersistTimer = undefined;
      this.persistWindows();
    }, AVAILABILITY_WINDOWS_PERSIST_DEBOUNCE_MS);
  }

  private enqueueWrite(write: () => Promise<void>) {
    this.writeQueue = this.writeQueue.then(write).catch(() => undefined);
  }

  private canPersist() {
    return this.hydrated && !this.storageReadFailed;
  }

  /** Nothing is written before a successful read: it would overwrite spend. */
  private persistBudget() {
    if (!this.canPersist()) return;
    const budget = this.getBudget();
    const state: IAvailabilityBudgetState = {
      version: 1,
      budgetDay: budget.budgetDay,
      budgetUsed: budget.budgetUsed,
      lastAttemptTs: budget.lastAttemptTs,
    };
    if (this.deps.persistWindows) {
      state.inflight = { ...this.inflight };
    }
    this.enqueueWrite(() => this.deps.storage.saveBudget(state));
  }

  private persistWindows() {
    if (!this.canPersist() || !this.deps.persistWindows) return;
    try {
      let text = JSON.stringify({
        version: 1,
        current: this.current,
        pending: this.pending,
      });
      if (text.length > AVAILABILITY_MAX_PERSISTED_WINDOWS_LENGTH) {
        // Keep counters and drop failure details when the payload is large.
        const withoutFailures = (window?: IAvailabilityWindow) =>
          window
            ? {
                ...window,
                failures: {},
                failuresOverflow:
                  window.failuresOverflow +
                  Object.values(window.failures).reduce((a, b) => a + b, 0),
              }
            : undefined;
        text = JSON.stringify({
          version: 1,
          current: withoutFailures(this.current),
          pending: withoutFailures(this.pending),
        });
        if (text.length > AVAILABILITY_MAX_PERSISTED_WINDOWS_LENGTH) {
          return;
        }
      }
      const snapshot = JSON.parse(text) as IAvailabilityWindowsState;
      this.enqueueWrite(() => this.deps.storage.saveWindows(snapshot));
    } catch {
      // Persistence is best effort; counters stay in memory.
    }
  }
}

const noopFlowHandle: IAvailabilityFlowHandle = {
  finish: () => undefined,
};

function getRuntimeStorageSuffix() {
  switch (platformEnv.runtimeRole) {
    case ERuntimeRole.Background:
      return 'background';
    case ERuntimeRole.Main:
      return 'main';
    default:
      return 'standalone';
  }
}

/** Rejects only when storage itself fails; corrupt JSON reads as absent. */
async function readStoredJson(key: string): Promise<unknown> {
  const raw = await appStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

type ILockManager = {
  request: <T>(name: string, callback: () => Promise<T>) => Promise<T>;
};

function getLockManager(): ILockManager | undefined {
  const { navigator } = globalThis as { navigator?: { locks?: ILockManager } };
  return typeof navigator?.locks?.request === 'function'
    ? navigator.locks
    : undefined;
}

async function waitUntilAnalyticsCanSend(): Promise<boolean> {
  const analytics = appGlobals.$analytics;
  if (!loggerConfig.isReady || !analytics) {
    return false;
  }
  let timer: ITimerId | undefined;
  try {
    return await Promise.race([
      analytics.whenInitialized().then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(
          () => resolve(false),
          AVAILABILITY_SEND_READY_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Runtimes that must not count: web embed relays analytics through its host
 * app (which counts itself), and the extension offscreen document never
 * initializes analytics, so its counters could never be sent.
 */
export function shouldCountAvailabilityInRuntime(env: {
  isWebEmbed?: boolean;
  isExtensionOffscreen?: boolean;
}) {
  return !env.isWebEmbed && !env.isExtensionOffscreen;
}

function createRuntimeAggregator(): AvailabilityAggregator | undefined {
  if (!shouldCountAvailabilityInRuntime(platformEnv)) {
    return undefined;
  }
  const suffix = getRuntimeStorageSuffix();
  const budgetKey = `onekey_availability_metrics_budget_${suffix}`;
  const windowsKey = `onekey_availability_metrics_windows_${suffix}`;
  const lockManager = getLockManager();
  return new AvailabilityAggregator({
    now: () => Date.now(),
    createId: () => generateUUID(),
    persistWindows: Boolean(
      platformEnv.isNative ||
      platformEnv.isDesktop ||
      platformEnv.isExtensionBackground,
    ),
    // Async app storage is durable in every runtime, including the extension
    // service worker (IndexedDB), and never blocks the desktop renderer.
    storage: {
      loadBudget: () => readStoredJson(budgetKey),
      saveBudget: (state) =>
        appStorage.setItem(budgetKey, JSON.stringify(state)),
      loadWindows: () => readStoredJson(windowsKey),
      saveWindows: (state) =>
        appStorage.setItem(windowsKey, JSON.stringify(state)),
    },
    scheduler: platformEnv.isJest
      ? undefined
      : {
          setInterval: (fn, ms) =>
            trackedSetInterval('availabilityAggregator', fn, ms),
          setTimeout: (fn, ms) => setTimeout(fn, ms),
        },
    subscribeVisibility: onVisibilityStateChange,
    canSend: waitUntilAnalyticsCanSend,
    send: (params) =>
      defaultLogger.app.network.reportAvailabilitySnapshot(params),
    withSharedBudgetLock: lockManager
      ? (task) => lockManager.request(budgetKey, task)
      : undefined,
  });
}

let runtimeAggregator: AvailabilityAggregator | undefined;
let runtimeAggregatorCreated = false;

function getRuntimeAggregator() {
  if (!runtimeAggregatorCreated) {
    runtimeAggregatorCreated = true;
    runtimeAggregator = createRuntimeAggregator();
  }
  return runtimeAggregator;
}

/** Records one outcome. Never throws into the instrumented business flow. */
export function recordAvailabilityOutcome(outcome: IAvailabilityOutcome) {
  try {
    getRuntimeAggregator()?.record(outcome);
  } catch {
    // Instrumentation must never affect the instrumented flow.
  }
}

/**
 * Counts a flow start and returns an idempotent handle for its outcome.
 * `trackUnfinished` persists the in-flight count so a process killed mid-flow
 * is reported as `unfinished` on the next launch of the same runtime.
 */
export function startAvailabilityFlow(
  flow: IAvailabilityFlow,
  options?: { detail?: string; trackUnfinished?: boolean },
): IAvailabilityFlowHandle {
  try {
    const handle = getRuntimeAggregator()?.startFlow(flow, options);
    if (!handle) {
      return noopFlowHandle;
    }
    return {
      finish: (result) => {
        try {
          handle.finish(result);
        } catch {
          // Instrumentation must never affect the instrumented flow.
        }
      },
    };
  } catch {
    return noopFlowHandle;
  }
}
