// Session Replay gate: the only place that decides whether recording runs.
//
// UI runtime only (native `main`, desktop renderer). Pure state, no SDK
// imports; the platform controller is injected through
// registerReplayController(). Every hook below is a cheap no-op until a
// controller is registered.
//
// Ordering rules:
// - Stopping is decided synchronously and is never skipped. Every start and
//   stop goes through one promise chain, so a stop can never be overtaken by
//   an earlier start.
// - Starting waits at least one frame plus RESUME_DELAY_MS, then re-checks the
//   decision and the generation right before calling the controller. Any stop
//   bumps the generation, which cancels pending starts and retries.

import { analytics } from '../../analytics';
import {
  getReplayBucket,
  isReplaySampled,
} from '../../analytics/sessionReplaySampling';

import type {
  IReplayController,
  IReplayControllerRegistration,
  IReplayGateCondition,
  IReplayGateStatus,
  IReplayPauseReason,
} from './replayTypes';

// Optional controller capabilities the gate uses when present. Kept out of the
// shared contract so controllers that do not need them stay unchanged.
export interface IReplayControllerExtensions {
  // Loads and configures the SDK without starting capture, so the gate can
  // re-check its decision right before the call that actually starts it.
  prepare?: () => Promise<void>;
  // Whether capture is actually running. Native SDKs refuse to start until
  // their remote config has loaded, so the gate retries while this is false.
  isRecordingActive?: () => Promise<boolean>;
}

type IGateController = IReplayController & IReplayControllerExtensions;

export const REPLAY_RESUME_DELAY_MS = 250;
export const REPLAY_START_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16_000];
// Events are linked to the replay session for as long as it can stay alive
// without activity.
export const REPLAY_ANALYTICS_CONTEXT_TTL_MS = 30 * 60 * 1000;

const CONDITION_ORDER: IReplayGateCondition[] = [
  'locked',
  'travelMode',
  'splitView',
  'background',
];

type IRegistrationState = {
  controller: IGateController;
  threshold: number;
  forced: boolean;
};

let registration: IRegistrationState | undefined;
let sessionId: string | undefined;
let bucket: number | undefined;
let sampled = false;
let routeAllowed = false;
let routeKey: string | undefined;
const pauseTokens = new Map<number, string>();
let nextPauseTokenId = 1;
const conditions: Record<IReplayGateCondition, boolean> = {
  locked: false,
  travelMode: false,
  splitView: false,
  background: false,
};

// True from the moment the gate decides to record until it decides to stop.
let desired = false;
// True once the controller confirmed capture for the current generation.
let recording = false;
let lastRecordingSessionId: string | undefined;
let lastRecordingStartedAt: number | undefined;
// Set once start() was called for the current registration. Restrictive
// changes then always send a stop, even if the gate believes it is idle.
let startIssued = false;
let generation = 0;
let chain: Promise<void> = Promise.resolve();
let touchQueued = false;

let resumeFrame: number | undefined;
let resumeTimer: ReturnType<typeof setTimeout> | undefined;

const statusListeners = new Set<(status: IReplayGateStatus) => void>();
let currentStatus: IReplayGateStatus = buildStatus();

function enqueue(task: () => Promise<void>): void {
  chain = chain.then(task).catch(() => undefined);
}

function getActiveConditions(): IReplayGateCondition[] {
  return CONDITION_ORDER.filter((condition) => conditions[condition]);
}

function computeShouldRecord(): boolean {
  return (
    !!registration &&
    sampled &&
    routeAllowed &&
    pauseTokens.size === 0 &&
    getActiveConditions().length === 0
  );
}

function computePauseReasons(): IReplayPauseReason[] {
  const reasons: IReplayPauseReason[] = [];
  if (!registration) {
    reasons.push('noController');
  } else if (!sampled) {
    reasons.push('notSampled');
  }
  if (!routeAllowed) {
    reasons.push('outOfScope');
  }
  if (pauseTokens.size > 0) {
    reasons.push('sensitive');
  }
  reasons.push(...getActiveConditions());
  return reasons;
}

function buildStatus(): IReplayGateStatus {
  return {
    hasController: !!registration,
    platform: registration?.controller.platform,
    sessionId,
    bucket,
    sampled,
    forced: registration?.forced ?? false,
    recording,
    lastRecordingSessionId,
    lastRecordingStartedAt,
    routeKey,
    pauseReasons: computePauseReasons(),
  };
}

function isSameStatus(a: IReplayGateStatus, b: IReplayGateStatus): boolean {
  return (
    a.hasController === b.hasController &&
    a.platform === b.platform &&
    a.sessionId === b.sessionId &&
    a.bucket === b.bucket &&
    a.sampled === b.sampled &&
    a.forced === b.forced &&
    a.recording === b.recording &&
    a.lastRecordingSessionId === b.lastRecordingSessionId &&
    a.lastRecordingStartedAt === b.lastRecordingStartedAt &&
    a.routeKey === b.routeKey &&
    a.pauseReasons.length === b.pauseReasons.length &&
    a.pauseReasons.every((reason, index) => reason === b.pauseReasons[index])
  );
}

function publishStatus(): void {
  const next = buildStatus();
  if (isSameStatus(next, currentStatus)) {
    return;
  }
  currentStatus = next;
  for (const listener of statusListeners) {
    try {
      listener(next);
    } catch {
      // A broken subscriber must not affect the gate.
    }
  }
}

function syncAnalyticsContext(): void {
  try {
    if (registration && sampled && sessionId) {
      analytics.setReplayContext({
        sessionId,
        expiresAt: Date.now() + REPLAY_ANALYTICS_CONTEXT_TTL_MS,
      });
    } else {
      analytics.setReplayContext(null);
    }
  } catch {
    // Linking is best effort.
  }
}

function cancelResume(): void {
  if (resumeFrame !== undefined) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(resumeFrame);
    }
    resumeFrame = undefined;
  }
  if (resumeTimer !== undefined) {
    clearTimeout(resumeTimer);
    resumeTimer = undefined;
  }
}

async function stopController(controller: IGateController): Promise<void> {
  try {
    await controller.stop();
    return;
  } catch {
    // Retried once below.
  }
  try {
    await controller.stop();
  } catch {
    // The controller cannot confirm the stop. Drop it so nothing starts again
    // in this context.
    if (registration?.controller === controller) {
      dropRegistration();
    }
  }
}

// Synchronous decision to stop: invalidates pending starts and queues an
// unconditional controller.stop() behind any in-flight call.
function requestStop(controller: IGateController | undefined): void {
  generation += 1;
  cancelResume();
  desired = false;
  recording = false;
  if (controller) {
    enqueue(() => stopController(controller));
  }
}

function attemptStart(expectedGeneration: number, attempt: number): void {
  enqueue(async () => {
    const current = registration;
    if (
      !current ||
      expectedGeneration !== generation ||
      !computeShouldRecord()
    ) {
      return;
    }
    const { controller } = current;
    startIssued = true;
    let active = false;
    try {
      if (controller.prepare) {
        await controller.prepare();
        // Loading the SDK can take a while; the user may have moved on.
        if (expectedGeneration !== generation || !computeShouldRecord()) {
          return;
        }
      }
      await controller.start();
      active = controller.isRecordingActive
        ? await controller.isRecordingActive()
        : true;
    } catch {
      active = false;
    }
    if (
      expectedGeneration !== generation ||
      registration?.controller !== controller
    ) {
      // A stop is already queued behind this call.
      return;
    }
    if (active) {
      recording = true;
      lastRecordingSessionId = sessionId;
      lastRecordingStartedAt = Date.now();
      publishStatus();
      return;
    }
    const delay = REPLAY_START_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      return;
    }
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined;
      if (expectedGeneration === generation) {
        attemptStart(expectedGeneration, attempt + 1);
      }
    }, delay);
  });
}

function scheduleResume(): void {
  cancelResume();
  const expectedGeneration = generation;
  const afterFrame = () => {
    resumeFrame = undefined;
    resumeTimer = setTimeout(() => {
      resumeTimer = undefined;
      if (expectedGeneration === generation) {
        attemptStart(expectedGeneration, 0);
      }
    }, REPLAY_RESUME_DELAY_MS);
  };
  if (typeof requestAnimationFrame === 'function') {
    resumeFrame = requestAnimationFrame(afterFrame);
  } else {
    afterFrame();
  }
}

// `restrictive` marks inputs that can only make recording less allowed; they
// always send a stop once anything was started, even if the gate believes the
// controller is idle.
function evaluate({ restrictive }: { restrictive: boolean }): void {
  const shouldRecord = computeShouldRecord();
  if (shouldRecord) {
    if (!desired) {
      desired = true;
      scheduleResume();
    }
  } else if (desired || (restrictive && startIssued)) {
    requestStop(registration?.controller);
  }
  publishStatus();
}

function applySession(nextSessionId: string | undefined): void {
  sessionId = nextSessionId;
  bucket = getReplayBucket(nextSessionId);
  sampled =
    !!registration &&
    !!nextSessionId &&
    (registration.forced ||
      isReplaySampled(nextSessionId, registration.threshold));
}

function dropRegistration(): void {
  const previous = registration;
  requestStop(previous?.controller);
  registration = undefined;
  startIssued = false;
  touchQueued = false;
  applySession(undefined);
  syncAnalyticsContext();
  publishStatus();
}

export function registerReplayController(
  reg: IReplayControllerRegistration,
): void {
  const controller = reg.controller as IGateController;
  const previous = registration;
  if (previous && previous.controller !== controller) {
    requestStop(previous.controller);
    startIssued = false;
  }
  const wasSampled = sampled;
  registration = {
    controller,
    threshold: reg.threshold,
    forced: reg.forced,
  };
  applySession(controller.getSessionId());
  syncAnalyticsContext();
  evaluate({ restrictive: wasSampled && !sampled });
}

export function unregisterReplayController(): void {
  if (!registration) {
    return;
  }
  dropRegistration();
}

// Synchronous: the stop decision is made before this returns. The returned
// release function is idempotent.
export function acquireReplayPause(tag: string): () => void {
  const id = nextPauseTokenId;
  nextPauseTokenId += 1;
  pauseTokens.set(id, tag);
  evaluate({ restrictive: true });
  return () => {
    if (pauseTokens.delete(id)) {
      evaluate({ restrictive: false });
    }
  };
}

export function setReplayRouteAllowed(
  allowed: boolean,
  nextRouteKey?: string,
): void {
  const changed = routeAllowed !== allowed || routeKey !== nextRouteKey;
  routeAllowed = allowed;
  routeKey = nextRouteKey;
  if (!changed) {
    return;
  }
  evaluate({ restrictive: !allowed });
}

export function setReplayCondition(
  condition: IReplayGateCondition,
  active: boolean,
): void {
  if (conditions[condition] === active) {
    return;
  }
  conditions[condition] = active;
  evaluate({ restrictive: active });
}

// Navigation / foreground: lets the controller rotate an idle or expired
// session and refreshes the analytics link. Coalesced and serialized with
// start/stop.
export function notifyReplayActivity(): void {
  if (!registration || touchQueued) {
    return;
  }
  touchQueued = true;
  enqueue(async () => {
    touchQueued = false;
    const current = registration;
    if (!current) {
      return;
    }
    const { controller } = current;
    let nextSessionId: string | undefined;
    try {
      nextSessionId = await controller.touchSession();
    } catch {
      return;
    }
    if (registration?.controller !== controller) {
      return;
    }
    if (nextSessionId !== sessionId) {
      // The controller stopped capture before switching ids. Restart the
      // decision from scratch for the new session.
      requestStop(startIssued ? controller : undefined);
      applySession(nextSessionId);
      evaluate({ restrictive: false });
    }
    syncAnalyticsContext();
  });
}

// Returns the same object until something changes, so it can back
// useSyncExternalStore directly.
export function getReplayGateStatus(): IReplayGateStatus {
  return currentStatus;
}

// Listeners are called on every change, not on subscribe.
export function subscribeReplayGateStatus(
  listener: (status: IReplayGateStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}
