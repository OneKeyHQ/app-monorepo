/**
 * Client API availability aggregator.
 *
 * API outcomes are counted in memory and sent as one `availabilitySnapshot`
 * event at most once per AVAILABILITY_MIN_SEND_GAP_MS (so at most 12 per
 * day), so analytics volume never scales with request volume or failure
 * storms.
 *
 * One aggregator per JS runtime. iOS/Android/extension main and background
 * runtimes keep their own counters and send time under runtime-specific
 * storage keys; desktop and web run one `standalone` runtime. Nothing is sent
 * or written before stored state is read, so a cold start cannot skip the gap.
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
  | 'api_endpoint'
  | 'api_ip_table'
  | 'api_net'
  | 'api_proxy'
  | 'api_route';

export type IAvailabilityOutcome = {
  source: IAvailabilitySource;
  target: string;
  status: string;
  /** Counted as slow at or above AVAILABILITY_SLOW_MS. */
  durationMs?: number;
  /** Failures only: the outcome is also kept in the failure details. */
  failure?: { detail: string; errorCode: string };
  /** The request went to a test environment host. */
  testEndpoint?: true;
};

export const AVAILABILITY_MIN_SEND_GAP_MS = 2 * 60 * 60 * 1000;
export const AVAILABILITY_SLOW_MS = 3000;
// Metrics produce about 180 counter keys at most today. With about 32 other
// event properties, this cap keeps an event under Mixpanel's 255-property
// limit.
const MAX_COUNTERS = 200;
export const AVAILABILITY_MAX_FAILURE_KEYS = 50;
const FAILURE_TEXT_PROPS = 4;
const FAILURE_TEXT_MAX_LENGTH = 255;
// Sends when due and stores recent counts; does nothing without data.
const TICK_MS = 60 * 1000;

export type IAvailabilityWindow = {
  id: string;
  startTs: number;
  endTs: number;
  windowCount: number;
  /** `${source}_${target}_${status}` and `${source}_${target}_slow`. */
  counters: Record<string, number>;
  /** `${source}|${target}|${status}|${detail}|${errorCode}`. */
  failures: Record<string, number>;
  /** Failure outcomes without a failure detail entry. */
  failuresOmitted: number;
  testEndpoint?: true;
};

type IStoredState = {
  version: 2;
  lastSendTs: number;
  current?: IAvailabilityWindow;
  pending?: IAvailabilityWindow;
};

export type IAvailabilityAggregatorDeps = {
  now: () => number;
  createId: () => string;
  /** Snapshot properties describing the sender, e.g. runtime scope. */
  meta: Record<string, string>;
  /**
   * Only single-instance runtimes persist counters. Web tabs and extension
   * pages share one key, so they persist only the last send time.
   */
  persistWindows: boolean;
  storage: {
    load: () => Promise<string | null | undefined>;
    save: (text: string) => Promise<void>;
  };
  setInterval?: (fn: () => void, ms: number) => unknown;
  subscribeVisibility?: (callback: (visible: boolean) => void) => unknown;
  canSend: () => Promise<boolean>;
  send: (params: IAvailabilitySnapshotParams) => Promise<void>;
};

function createWindow(id: string, now: number): IAvailabilityWindow {
  return {
    id,
    startTs: now,
    endTs: now,
    windowCount: 1,
    counters: {},
    failures: {},
    failuresOmitted: 0,
  };
}

function isWindow(value: unknown): value is IAvailabilityWindow {
  const window = value as IAvailabilityWindow | undefined;
  return (
    typeof window?.id === 'string' &&
    [
      window.startTs,
      window.endTs,
      window.windowCount,
      window.failuresOmitted,
    ].every(Number.isFinite) &&
    !!window.counters &&
    typeof window.counters === 'object' &&
    !!window.failures &&
    typeof window.failures === 'object'
  );
}

/** Returns false when a new key does not fit. */
function addCount(
  record: Record<string, number>,
  key: string,
  count: number,
  maxKeys: number,
) {
  if (!Number.isFinite(count) || count <= 0) return true;
  if (record[key] === undefined && Object.keys(record).length >= maxKeys) {
    return false;
  }
  record[key] = (record[key] ?? 0) + count;
  return true;
}

export function addAvailabilityOutcome(
  window: IAvailabilityWindow,
  outcome: IAvailabilityOutcome,
) {
  const prefix = `${outcome.source}_${outcome.target}`;
  addCount(window.counters, `${prefix}_${outcome.status}`, 1, MAX_COUNTERS);
  if (outcome.testEndpoint) window.testEndpoint = true;
  if ((outcome.durationMs ?? 0) >= AVAILABILITY_SLOW_MS) {
    addCount(window.counters, `${prefix}_slow`, 1, MAX_COUNTERS);
  }
  if (outcome.failure) {
    const { detail, errorCode } = outcome.failure;
    const key = [
      outcome.source,
      outcome.target,
      outcome.status,
      detail,
      errorCode,
    ].join('|');
    if (!addCount(window.failures, key, 1, AVAILABILITY_MAX_FAILURE_KEYS)) {
      window.failuresOmitted += 1;
    }
  }
}

function mergeWindows(
  target: IAvailabilityWindow,
  source: IAvailabilityWindow,
) {
  target.startTs = Math.min(target.startTs, source.startTs);
  target.endTs = Math.max(target.endTs, source.endTs);
  target.windowCount += source.windowCount;
  target.failuresOmitted += source.failuresOmitted;
  if (source.testEndpoint) target.testEndpoint = true;
  for (const [key, count] of Object.entries(source.counters)) {
    addCount(target.counters, key, count, MAX_COUNTERS);
  }
  for (const [key, count] of Object.entries(source.failures)) {
    if (!addCount(target.failures, key, count, AVAILABILITY_MAX_FAILURE_KEYS)) {
      target.failuresOmitted += count;
    }
  }
  return target;
}

/**
 * Flattens a window into summable event properties: every counter as a
 * number, plus the most frequent failure details packed into `failures_1..4`.
 */
export function buildAvailabilitySnapshotParams(
  window: IAvailabilityWindow,
  meta: Record<string, string>,
): IAvailabilitySnapshotParams {
  const params: IAvailabilitySnapshotParams = {
    ...meta,
    schemaVersion: 3,
    snapshotId: window.id,
    endpointEnv: window.testEndpoint ? 'test' : 'prod',
    windowStartTs: window.startTs,
    windowEndTs: window.endTs,
    windowCount: window.windowCount,
    ...window.counters,
  };
  const texts: string[] = [];
  let { failuresOmitted } = window;
  const sortedFailures = Object.entries(window.failures).toSorted(
    (a, b) => b[1] - a[1],
  );
  for (const [key, count] of sortedFailures) {
    const part = `${key}=${count}`;
    const last = texts.length - 1;
    if (
      last >= 0 &&
      texts[last].length + 1 + part.length <= FAILURE_TEXT_MAX_LENGTH
    ) {
      texts[last] = `${texts[last]},${part}`;
    } else if (
      texts.length < FAILURE_TEXT_PROPS &&
      part.length <= FAILURE_TEXT_MAX_LENGTH
    ) {
      texts.push(part);
    } else {
      failuresOmitted += count;
    }
  }
  texts.forEach((text, index) => {
    params[`failures_${index + 1}`] = text;
  });
  if (failuresOmitted > 0) params.failuresOmitted = failuresOmitted;
  return params;
}

function parseStoredState(text: string | null | undefined) {
  try {
    const state = text ? (JSON.parse(text) as IStoredState) : undefined;
    return state?.version === 2 && Number.isFinite(state.lastSendTs)
      ? state
      : undefined;
  } catch {
    return undefined;
  }
}

export class AvailabilityAggregator {
  private lastSendTs = 0;

  private current: IAvailabilityWindow | undefined;

  /** Already sent once under its id, so it is only ever resent unchanged. */
  private pending: IAvailabilityWindow | undefined;

  /** Resolves false when stored state could not be read. */
  private ready: Promise<boolean> | undefined;

  private canWrite = false;

  private dirty = false;

  private flushing: Promise<void> | undefined;

  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: IAvailabilityAggregatorDeps) {}

  record(outcome: IAvailabilityOutcome) {
    this.start();
    const now = this.deps.now();
    this.current ??= createWindow(this.deps.createId(), now);
    addAvailabilityOutcome(this.current, outcome);
    this.current.endTs = now;
    this.dirty = true;
  }

  flush(reason: 'hidden' | 'tick'): Promise<void> {
    this.start();
    // Before coalescing: the process may be killed soon after it is hidden.
    if (reason === 'hidden' || this.dirty) this.persist();
    this.flushing ??= this.flushInternal()
      .catch(() => undefined)
      .finally(() => {
        this.flushing = undefined;
      });
    return this.flushing;
  }

  private start() {
    if (this.ready) return;
    this.ready = this.hydrate();
    this.deps.setInterval?.(() => {
      void this.flush('tick');
    }, TICK_MS);
    this.deps.subscribeVisibility?.((visible) => {
      if (!visible) void this.flush('hidden');
    });
  }

  private async hydrate() {
    let text: string | null | undefined;
    try {
      text = await this.deps.storage.load();
    } catch {
      // Unknown last send: never send or write in this process.
      return false;
    }
    this.canWrite = true;
    const stored = parseStoredState(text);
    if (!stored) return true;
    this.lastSendTs = stored.lastSendTs;
    if (!this.deps.persistWindows) return true;
    // The previous process of this runtime is gone; its windows are unsent.
    if (isWindow(stored.pending)) this.pending = stored.pending;
    if (isWindow(stored.current)) {
      this.current = this.current
        ? mergeWindows(this.current, stored.current)
        : stored.current;
    }
    return true;
  }

  private isSendDue(now: number) {
    // A clock moved backwards restarts the gap instead of blocking sends.
    this.lastSendTs = Math.min(this.lastSendTs, now);
    return now - this.lastSendTs >= AVAILABILITY_MIN_SEND_GAP_MS;
  }

  private async flushInternal() {
    if (
      !(await this.ready) ||
      !(this.current || this.pending) ||
      !this.isSendDue(this.deps.now()) ||
      !(await this.deps.canSend())
    ) {
      return;
    }
    if (!this.deps.persistWindows) {
      // Other tabs or extension pages share the stored send time.
      const stored = parseStoredState(await this.deps.storage.load());
      if (stored) this.lastSendTs = stored.lastSendTs;
      if (!this.isSendDue(this.deps.now())) return;
    }
    if (!this.pending) {
      this.pending = this.current;
      this.current = undefined;
    }
    const window = this.pending;
    if (!window) return;
    // Stored before sending: a failing endpoint is paced like a success, and a
    // process killed mid-send sends this window again unchanged under its id.
    this.lastSendTs = this.deps.now();
    this.persist(true);
    await this.writeQueue;
    await this.deps.send(
      buildAvailabilitySnapshotParams(window, this.deps.meta),
    );
    this.pending = undefined;
    this.persist();
  }

  /** Multi-instance runtimes store only the send time, when sending. */
  private persist(sending = false) {
    if (!this.canWrite || (!this.deps.persistWindows && !sending)) return;
    this.dirty = false;
    const state: IStoredState = { version: 2, lastSendTs: this.lastSendTs };
    if (this.deps.persistWindows) {
      state.current = this.current;
      state.pending = this.pending;
    }
    // Serialized now, so later changes to the windows are not written early.
    const text = JSON.stringify(state);
    this.writeQueue = this.writeQueue
      .then(() => this.deps.storage.save(text))
      .catch(() => undefined);
  }
}

function getRuntimeScope() {
  switch (platformEnv.runtimeRole) {
    case ERuntimeRole.Background:
      return 'bg';
    case ERuntimeRole.Main:
      return 'main';
    default:
      return 'standalone';
  }
}

async function waitUntilAnalyticsCanSend() {
  const analytics = appGlobals.$analytics;
  if (!loggerConfig.isReady || !analytics) return false;
  await analytics.whenInitialized();
  return true;
}

function createRuntimeAggregator() {
  // Web embed is counted by its host app; the extension offscreen document
  // never initializes analytics.
  if (platformEnv.isWebEmbed || platformEnv.isExtensionOffscreen) {
    return undefined;
  }
  const runtimeScope = getRuntimeScope();
  const key = `onekey_availability_metrics_${runtimeScope}`;
  return new AvailabilityAggregator({
    now: () => Date.now(),
    createId: generateUUID,
    // The app version is on every event; the JS bundle can change without it.
    meta: { runtimeScope, bundleVersion: platformEnv.bundleVersion ?? '' },
    persistWindows: Boolean(
      platformEnv.isNative ||
      platformEnv.isDesktop ||
      platformEnv.isExtensionBackground,
    ),
    storage: {
      load: () => appStorage.getItem(key),
      save: (text) => appStorage.setItem(key, text),
    },
    setInterval: platformEnv.isJest
      ? undefined
      : (fn, ms) => trackedSetInterval('availabilityAggregator', fn, ms),
    subscribeVisibility: platformEnv.isJest
      ? undefined
      : onVisibilityStateChange,
    canSend: waitUntilAnalyticsCanSend,
    send: (params) =>
      defaultLogger.app.network.reportAvailabilitySnapshot(params),
  });
}

let runtimeAggregator: AvailabilityAggregator | undefined | null = null;

function getRuntimeAggregator() {
  if (runtimeAggregator === null) {
    runtimeAggregator = createRuntimeAggregator();
  }
  return runtimeAggregator;
}

/** Records one outcome. Never throws into the request path. */
export function recordAvailabilityOutcome(outcome: IAvailabilityOutcome) {
  try {
    getRuntimeAggregator()?.record(outcome);
  } catch {
    // Metrics must never affect requests.
  }
}

/**
 * Called when the app is hidden. The native background runtime receives no
 * AppState events, so the main runtime relays them here.
 */
export function flushAvailabilitySnapshotOnHidden() {
  try {
    void getRuntimeAggregator()?.flush('hidden');
  } catch {
    // Metrics must never affect the caller.
  }
}
