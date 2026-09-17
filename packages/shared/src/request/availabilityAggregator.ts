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

/**
 * `record` is the trigger that does not depend on the host: an outcome means
 * this runtime is alive and doing network work, which is exactly when a send
 * can land. The others are accelerators.
 */
export type IAvailabilityFlushReason = 'hidden' | 'record' | 'tick';

export const AVAILABILITY_MIN_SEND_GAP_MS = 2 * 60 * 60 * 1000;
export const AVAILABILITY_SLOW_MS = 3000;
// Metrics produce at most 193 counter keys per runtime today. With at most 34
// other event properties, this cap keeps an event under the 255-property
// limit. Two more service or endpoint labels would overflow it, so raise this
// alongside them.
const MAX_COUNTERS = 200;
export const AVAILABILITY_MAX_FAILURE_KEYS = 50;
// Four slots held about 16 entries, and a single six-minute outage already
// overflowed them. Eight covers the 50-key cap at the sizes seen on device.
const FAILURE_TEXT_PROPS = 8;
const FAILURE_TEXT_MAX_LENGTH = 255;
// Sends when due and stores recent counts; does nothing without data.
const TICK_MS = 60 * 1000;
// Window timestamps this far from the current clock are not sent as event time.
const CLOCK_TRUST_MS = 24 * 60 * 60 * 1000;
// A flush must fail closed and retry rather than park: an await that never
// settles used to silence a runtime for the rest of its life.
const FLUSH_STEP_TIMEOUT_MS = 10 * 1000;
// Bounds the re-run loop when triggers keep arriving mid-flush.
const MAX_FLUSH_RERUNS = 3;
// Delivery waits on the server, so it gets a longer bound than the local steps.
const SEND_TIMEOUT_MS = 60 * 1000;
// Minimum age of a window the traffic-driven trigger will ship.
const MIN_WINDOW_AGE_MS = TICK_MS;
/** Tells "the check answered no" apart from "the check never answered". */
const STALLED = Symbol('availabilityFlushStalled');
/** Flush results that are the design working, not something to report on. */
const BENIGN_FLUSH_RESULTS = new Set([
  'noWindow',
  'notDue',
  'notDueShared',
  'sent',
]);

export type IAvailabilityWindow = {
  id: string;
  startTs: number;
  endTs: number;
  windowCount: number;
  /** `${source}_${target}_${status}` and `${source}_${target}_slow_outcome`. */
  counters: Record<string, number>;
  /** `${source}|${target}|${status}|${detail}|${errorCode}`. */
  failures: Record<string, number>;
  /** Failure outcomes without a failure detail entry. */
  failuresOmitted: number;
  /**
   * Counts that did not fit MAX_COUNTERS. Optional so a window stored by an
   * earlier build still hydrates.
   */
  countersOmitted?: number;
  testEndpoint?: true;
  /**
   * The JS bundle that recorded the window. A window restored after an OTA
   * update was recorded by the previous bundle, not by the one sending it.
   */
  bundleVersion?: string;
};

type IStoredState = {
  // 3: `_slow` became `_slow_outcome`, so counters of the two shapes must not
  // merge into one window.
  version: 3;
  lastSendTs: number;
  current?: IAvailabilityWindow;
  pending?: IAvailabilityWindow;
  /** Survives a restart, so a runtime that went quiet explains itself. */
  lastIssue?: string;
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
  /**
   * Cross-instance exclusion around claiming a send. Only multi-instance
   * runtimes need it: tabs and extension pages share one stored send time, so
   * re-reading it is not enough to keep two of them from claiming the same
   * slot. Absent where a runtime owns its key.
   */
  withSendLock?: (task: () => Promise<void>) => Promise<void>;
  /** Device-side diagnostics: why a flush did or did not send. */
  log?: (reason: string, result: string) => void;
};

/**
 * Settles with `fallback` if the promise has not settled in time. The promise
 * itself is left running; only this flush attempt gives up on it.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    const settle = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    void promise.then(settle, () => settle(fallback));
  });
}

function createWindow(
  id: string,
  now: number,
  bundleVersion: string | undefined,
): IAvailabilityWindow {
  return {
    bundleVersion,
    id,
    startTs: now,
    endTs: now,
    windowCount: 1,
    counters: {},
    failures: {},
    failuresOmitted: 0,
    countersOmitted: 0,
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
    typeof window.failures === 'object' &&
    (window.countersOmitted === undefined ||
      Number.isFinite(window.countersOmitted)) &&
    (window.bundleVersion === undefined ||
      typeof window.bundleVersion === 'string')
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

/** Counts a key, reporting the overflow the failure details already report. */
function addWindowCount(
  window: IAvailabilityWindow,
  key: string,
  count: number,
) {
  if (!addCount(window.counters, key, count, MAX_COUNTERS)) {
    window.countersOmitted = (window.countersOmitted ?? 0) + count;
  }
}

export function addAvailabilityOutcome(
  window: IAvailabilityWindow,
  outcome: IAvailabilityOutcome,
) {
  const prefix = `${outcome.source}_${outcome.target}`;
  addWindowCount(window, `${prefix}_${outcome.status}`, 1);
  if (outcome.testEndpoint) window.testEndpoint = true;
  if ((outcome.durationMs ?? 0) >= AVAILABILITY_SLOW_MS) {
    // Named for what it counts: outcomes of any status that took at least
    // AVAILABILITY_SLOW_MS, failures included. Its denominator is the sum of
    // the prefix's status counters, never the `_ok` one.
    addWindowCount(window, `${prefix}_slow_outcome`, 1);
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
  target.countersOmitted =
    (target.countersOmitted ?? 0) + (source.countersOmitted ?? 0);
  if (source.testEndpoint) target.testEndpoint = true;
  for (const [key, count] of Object.entries(source.counters)) {
    addWindowCount(target, key, count);
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
 * number, plus the most frequent failure details packed into `failures_1..8`.
 */
export function buildAvailabilitySnapshotParams(
  window: IAvailabilityWindow,
  meta: Record<string, string>,
  now: number,
  /** Why the previous flush did not send, if it did not. */
  lastIssue?: string,
): IAvailabilitySnapshotParams {
  const params: IAvailabilitySnapshotParams = {
    ...meta,
    // 4: `_slow` became `_slow_outcome`, `api_net` gained the `unread` and
    // `unsupported` targets, and `countersOmitted` was added.
    schemaVersion: 4,
    snapshotId: window.id,
    // Deduplicates a resent window and dates it at the window end. A clock
    // far from this one is left to the server, which dates it on arrival.
    $insertId: window.id,
    ...(Math.abs(now - window.endTs) <= CLOCK_TRUST_MS
      ? { $timestamp: window.endTs }
      : {}),
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
    // First fit across every slot: appending only to the last one left room
    // unused in the earlier slots while entries were being dropped.
    const slot = texts.findIndex(
      (text) => text.length + 1 + part.length <= FAILURE_TEXT_MAX_LENGTH,
    );
    if (slot >= 0) {
      texts[slot] = `${texts[slot]},${part}`;
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
  if (window.countersOmitted) params.countersOmitted = window.countersOmitted;
  // The device-side diagnostic is a debug line the native logger may drop
  // under load, which is exactly when a flush is most likely to have failed.
  if (lastIssue) params.lastFlushIssue = lastIssue;
  // `bundleVersion` in meta is the sender. Filter on this one to ask what a
  // given bundle measured; it is absent for windows from builds before it.
  if (window.bundleVersion) params.windowBundleVersion = window.bundleVersion;
  return params;
}

function parseStoredState(text: string | null | undefined) {
  try {
    const state = text ? (JSON.parse(text) as IStoredState) : undefined;
    return state?.version === 3 && Number.isFinite(state.lastSendTs)
      ? state
      : undefined;
  } catch {
    return undefined;
  }
}

export class AvailabilityAggregator {
  private lastSendTs = 0;

  private current: IAvailabilityWindow | undefined;

  /**
   * Sealed: already sent once under its id, or restored from another bundle.
   * Either way it is only ever sent unchanged, ahead of `current`.
   */
  private pending: IAvailabilityWindow | undefined;

  /** Resolves false when stored state could not be read. */
  private ready: Promise<boolean> | undefined;

  private canWrite = false;

  private dirty = false;

  private flushing: Promise<void> | undefined;

  /** A trigger arrived while a flush was in flight. */
  private flushAgain = false;

  private lastFlushAttemptTs = 0;

  /** Last flush result that was not a send, reported on the next snapshot. */
  private lastIssue: string | undefined;

  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: IAvailabilityAggregatorDeps) {}

  record(outcome: IAvailabilityOutcome) {
    this.start();
    const now = this.deps.now();
    this.current ??= createWindow(
      this.deps.createId(),
      now,
      this.deps.meta.bundleVersion,
    );
    addAvailabilityOutcome(this.current, outcome);
    this.current.endTs = now;
    this.dirty = true;
    // Delivery is driven by the traffic being measured, so it does not depend
    // on a timer the host runtime may not honour, on an AppState event the
    // native background runtime never receives, or on a visibility signal an
    // extension service worker does not have. Throttled to the tick cadence.
    //
    // Single-instance runtimes only: tabs and extension pages share one send
    // time, so a request-driven flush in each of them would race past the
    // shared-gap re-read and send twice. They have a document, so their
    // visibility trigger already works.
    if (
      this.deps.persistWindows &&
      now - this.lastFlushAttemptTs >= TICK_MS &&
      // A fresh runtime has never sent, so the gap is satisfied at once and
      // this trigger would ship the window holding its first outcome, before
      // the asynchronous network-type read has landed. Sampling starts here.
      now - (this.current?.startTs ?? now) >= MIN_WINDOW_AGE_MS &&
      this.isSendDue(now)
    ) {
      this.lastFlushAttemptTs = now;
      void this.flush('record');
    }
  }

  flush(reason: IAvailabilityFlushReason): Promise<void> {
    this.start();
    // Before coalescing: the process may be killed soon after it is hidden.
    if (reason === 'hidden' || this.dirty) void this.persist();
    if (this.flushing) {
      // A flush already in flight may be waiting on readiness or on analytics.
      // Remember this trigger instead of dropping it: plain coalescing used to
      // turn every later tick and relay into a silent no-op.
      this.flushAgain = true;
      return this.flushing;
    }
    this.flushing = this.runFlushLoop(reason)
      .catch(() => undefined)
      .finally(() => {
        this.flushing = undefined;
      });
    return this.flushing;
  }

  private async runFlushLoop(reason: IAvailabilityFlushReason) {
    for (let run = 0; run <= MAX_FLUSH_RERUNS; run += 1) {
      this.flushAgain = false;
      await this.flushInternal(reason);
      if (!this.flushAgain) return;
    }
  }

  private start() {
    if (this.ready) return;
    // Armed before readiness is latched, and each in its own guard: a throw
    // here used to leave `ready` set, so every later start() returned early
    // and both triggers stayed unarmed for the life of the runtime, silently.
    try {
      this.deps.setInterval?.(() => {
        void this.flush('tick');
      }, TICK_MS);
    } catch {
      this.noteFlushIssue('tickArmFailed');
      this.deps.log?.('start', 'tickArmFailed');
    }
    try {
      this.deps.subscribeVisibility?.((visible) => {
        if (!visible) void this.flush('hidden');
      });
    } catch {
      this.noteFlushIssue('visibilityArmFailed');
      this.deps.log?.('start', 'visibilityArmFailed');
    }
    this.ready = this.hydrate().then((ok) => {
      // Outcomes recorded before the stored state was read could not be
      // written: `persist` was still refusing to touch storage. A runtime
      // hidden inside that window would otherwise be suspended holding the
      // only copy, since nothing else writes until the next tick.
      if (ok && this.dirty) void this.persist();
      return ok;
    });
  }

  private async hydrate() {
    let text: string | null | undefined;
    try {
      text = await this.deps.storage.load();
    } catch {
      // Unknown last send: never send or write in this process.
      this.deps.log?.('hydrate', 'loadFailed');
      return false;
    }
    this.canWrite = true;
    const stored = parseStoredState(text);
    // Logged either way: a silent success is indistinguishable from a hydrate
    // that never finished, which is the state a stalled flush reports.
    this.deps.log?.('hydrate', stored ? 'restored' : 'fresh');
    if (!stored) return true;
    this.lastSendTs = stored.lastSendTs;
    if (typeof stored.lastIssue === 'string') this.lastIssue = stored.lastIssue;
    if (!this.deps.persistWindows) return true;
    // The previous process of this runtime is gone; its windows are unsent.
    if (isWindow(stored.pending)) this.pending = stored.pending;
    if (
      isWindow(stored.current) &&
      !this.pending &&
      stored.current.bundleVersion !== this.deps.meta.bundleVersion
    ) {
      // Recorded by another bundle (or by one that did not stamp windows).
      // Continuing it would credit that bundle's outcomes to this one, which
      // is exactly how a fix looks like it did nothing right after the OTA
      // update that shipped it. Sent on its own, before this bundle's window.
      this.pending = stored.current;
    } else if (isWindow(stored.current)) {
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

  /** Kept for the next snapshot: a log line is droppable, a property is not. */
  private noteFlushIssue(issue: string) {
    this.lastIssue = issue;
  }

  private async flushInternal(reason: IAvailabilityFlushReason) {
    const report = (result: string) => {
      if (!BENIGN_FLUSH_RESULTS.has(result)) this.noteFlushIssue(result);
      this.deps.log?.(reason, result);
    };
    // Each wait is bounded so a stalled dependency costs this attempt only.
    const ready = await withTimeout<boolean | typeof STALLED>(
      this.ready ?? Promise.resolve(false),
      FLUSH_STEP_TIMEOUT_MS,
      STALLED,
    );
    if (ready !== true) {
      report(ready === STALLED ? 'readyStalled' : 'notReady');
      return;
    }
    if (!(this.current || this.pending)) {
      report('noWindow');
      return;
    }
    if (!this.isSendDue(this.deps.now())) {
      report('notDue');
      return;
    }
    // Analytics initialization has no timeout of its own, so a runtime whose
    // bootstrap stalls must be distinguishable from one that declined.
    const canSend = await withTimeout<boolean | typeof STALLED>(
      this.deps.canSend(),
      FLUSH_STEP_TIMEOUT_MS,
      STALLED,
    );
    if (canSend !== true) {
      report(canSend === STALLED ? 'canSendStalled' : 'cannotSend');
      return;
    }
    // Claiming is re-reading the shared send time, taking the window and
    // storing the new send time. It runs under the lock where one exists, so
    // two instances cannot read the same due slot; the send itself is left
    // outside it, so a slow network call never blocks another instance.
    let window: IAvailabilityWindow | undefined;
    const claim = async () => {
      if (!this.deps.persistWindows) {
        // Other tabs or extension pages share the stored send time.
        const text = await withTimeout<
          string | null | undefined | typeof STALLED
        >(this.deps.storage.load(), FLUSH_STEP_TIMEOUT_MS, STALLED);
        if (text === STALLED) {
          report('loadStalled');
          return;
        }
        const stored = parseStoredState(text);
        if (stored) this.lastSendTs = stored.lastSendTs;
        if (!this.isSendDue(this.deps.now())) {
          report('notDueShared');
          return;
        }
      }
      if (!this.pending) {
        this.pending = this.current;
        this.current = undefined;
      }
      if (!this.pending) {
        report('noWindow');
        return;
      }
      // Stored before sending: a failing endpoint is paced like a success, and
      // a process killed mid-send sends this window again unchanged under its
      // id. The send is claimed by that write, so a storage failure must stop
      // it: the gap it carries is the only thing pacing this runtime across a
      // restart, and a resend after one would bill a fresh id that the server
      // cannot deduplicate.
      const unclaimedSendTs = this.lastSendTs;
      this.lastSendTs = this.deps.now();
      const claimed = await withTimeout<boolean | typeof STALLED>(
        this.persist(true),
        FLUSH_STEP_TIMEOUT_MS,
        STALLED,
      );
      if (claimed !== true) {
        // Still due, so the next trigger retries rather than sending past the gap.
        this.lastSendTs = unclaimedSendTs;
        report(claimed === STALLED ? 'claimStalled' : 'claimFailed');
        return;
      }
      window = this.pending;
    };
    const lock = this.deps.withSendLock;
    if (lock) {
      // Only the wait for the lock is bounded. Once it is granted the claim
      // runs to the end, since each of its steps is bounded already; a grant
      // that arrives after this attempt gave up claims nothing, because a
      // slot taken then would have nobody left to send it.
      let granted = false;
      let abandoned = false;
      const run = lock(async () => {
        if (abandoned) return;
        granted = true;
        await claim();
      });
      const settled = await withTimeout<boolean | typeof STALLED>(
        run.then(() => true),
        FLUSH_STEP_TIMEOUT_MS,
        STALLED,
      );
      if (settled === STALLED) {
        if (!granted) {
          abandoned = true;
          report('lockStalled');
          return;
        }
        await run;
      }
    } else {
      await claim();
    }
    if (!window) return;
    try {
      // Bounded like every other step: delivery waits on the server, and a
      // request that never settles would hold the flush memo for good.
      const delivered = await withTimeout<boolean | typeof STALLED>(
        this.deps
          .send(
            buildAvailabilitySnapshotParams(
              window,
              this.deps.meta,
              this.deps.now(),
              this.lastIssue,
            ),
          )
          .then(() => true),
        SEND_TIMEOUT_MS,
        STALLED,
      );
      if (delivered === STALLED) {
        // Kept pending and resent unchanged under the same id, which the
        // server deduplicates if this one did land after all.
        report('sendStalled');
        return;
      }
    } catch (error) {
      // The window stays pending and is resent unchanged under the same id.
      report('sendFailed');
      throw error;
    }
    this.pending = undefined;
    this.lastIssue = undefined;
    void this.persist();
    report('sent');
  }

  /**
   * Multi-instance runtimes store only the send time, when sending. Resolves
   * false when the write did not land, so the caller can decide: the stored
   * send time is the only thing that paces this runtime across a restart.
   */
  private persist(sending = false): Promise<boolean> {
    if (!this.canWrite || (!this.deps.persistWindows && !sending)) {
      return Promise.resolve(false);
    }
    this.dirty = false;
    const state: IStoredState = {
      version: 3,
      lastSendTs: this.lastSendTs,
      lastIssue: this.lastIssue,
    };
    if (this.deps.persistWindows) {
      state.current = this.current;
      state.pending = this.pending;
    }
    // Serialized now, so later changes to the windows are not written early.
    const text = JSON.stringify(state);
    const written = this.writeQueue
      .then(() => this.deps.storage.save(text))
      .then(
        () => true,
        () => {
          // Still unwritten: let a later trigger try again, rather than leave
          // the counters in memory for a process that may be killed.
          this.dirty = true;
          return false;
        },
      );
    // The queue itself must stay settled, whatever the result was.
    this.writeQueue = written.then(() => undefined);
    return written;
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
    // Wired unconditionally. These were gated on `platformEnv.isJest`, a
    // build-time define that Metro's worker-thread transformer resolves to
    // `true`, so native bundles shipped with neither the tick nor the
    // visibility flush. Tests construct the aggregator with their own deps.
    setInterval: (fn, ms) =>
      trackedSetInterval('availabilityAggregator', fn, ms),
    subscribeVisibility: onVisibilityStateChange,
    // Web Locks are per origin, which is exactly the sharing scope: one
    // namespace for the app's tabs, one for the extension's pages. Absent on
    // React Native, where each runtime owns its key and needs no exclusion.
    withSendLock: globalThis.navigator?.locks
      ? (task) => globalThis.navigator.locks.request(key, task)
      : undefined,
    canSend: waitUntilAnalyticsCanSend,
    send: (params) =>
      defaultLogger.app.network.reportAvailabilitySnapshot(params),
    log: (reason, result) => {
      try {
        defaultLogger.app.network.availabilityFlush(reason, result);
      } catch {
        // Diagnostics must never affect requests.
      }
    },
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
