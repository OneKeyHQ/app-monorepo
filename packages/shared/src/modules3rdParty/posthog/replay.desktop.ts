// cspell:ignore rrweb rageclick pageleave
// Session Replay controller for the desktop renderer.
//
// Desktop is single-runtime: app main and bg share the renderer's JS heap,
// and this module is reached only from UI code through a dynamic import. The
// Electron main process is not involved. posthog-js and its recorder bundle
// are loaded with import() so neither enters the startup graph.
//
// Uses its own PostHog instance (never the default singleton) with every
// non-replay feature off and recording disabled until the gate starts it.

import { isReplaySampled } from '../../analytics/sessionReplaySampling';
import platformEnv from '../../platformEnv';

import {
  REPLAY_SAMPLE_THRESHOLDS,
  getReplayProjectConfig,
} from './replayConfig';
import {
  createReplayBlockWindows,
  filterReplaySnapshotData,
  maskReplayNetworkRequest,
} from './replayDomPrivacy';
import {
  getReplayGateStatus,
  notifyReplayActivity,
  registerReplayController,
  subscribeReplayGateStatus,
  unregisterReplayController,
} from './replayGate';

import type { IReplayBlockWindows } from './replayDomPrivacy';
import type { IReplayControllerExtensions } from './replayGate';
import type {
  IInitSessionReplayOptions,
  IReplayController,
  IReplayGateStatus,
} from './replayTypes';
import type { BeforeSendFn, PostHog, PostHogConfig } from 'posthog-js';

export const REPLAY_DESKTOP_PERSISTENCE_NAME = 'ph_replay';

// Cross-origin frames and Electron <webview>s carry provider URLs in their
// src; QR codes and other sensitive views carry the `ph-no-capture` test id.
export const REPLAY_DESKTOP_BLOCK_SELECTOR =
  'iframe, webview, [data-ph-block], [data-testid*="ph-no-capture"]';

// posthog-js persists the session as [lastActivity, sessionId, startedAt].
const SESSION_ID_PROPERTY = '$sesid';
const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
// Mirrors posthog-js SESSION_LENGTH_LIMIT_MILLISECONDS.
const MAX_SESSION_LENGTH_MS = 24 * 60 * 60 * 1000;

type IDesktopReplayController = IReplayController & IReplayControllerExtensions;

type IReplayPolicy = {
  threshold: number;
  forced: boolean;
};

type IPersistedReplaySession = {
  lastActivity: number;
  sessionId: string | undefined;
  startedAt: number;
};

export function buildDesktopReplayConfig({
  host,
  instanceId,
  beforeSend,
}: {
  host: string;
  instanceId: string;
  beforeSend: BeforeSendFn;
}): Partial<PostHogConfig> {
  return {
    api_host: host,
    bootstrap: { distinctID: instanceId },
    persistence: 'localStorage',
    persistence_name: REPLAY_DESKTOP_PERSISTENCE_NAME,
    disable_session_recording: true,
    disable_external_dependency_loading: true,
    // Skips /flags only. advanced_disable_flags would also skip the remote
    // config that turns replay on, and recording would never start.
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    autocapture: false,
    rageclick: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_performance: false,
    enable_recording_console_log: false,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_scroll_properties: true,
    save_referrer: false,
    save_campaign_params: false,
    before_send: beforeSend,
    session_recording: {
      // OneKey's bucket check is the only sampling decision.
      sampleRate: 1,
      maskAllInputs: true,
      maskTextSelector: '*',
      blockSelector: REPLAY_DESKTOP_BLOCK_SELECTOR,
      recordCrossOriginIframes: false,
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      // Per-event compression would hide payloads from the before_send
      // scrubber; requests are still gzip-compressed as a whole.
      compress_events: false,
      maskCapturedNetworkRequestFn: maskReplayNetworkRequest,
    },
  };
}

function isSessionAllowed(
  sessionId: string | undefined,
  policy: IReplayPolicy,
): boolean {
  return (
    !!sessionId &&
    (policy.forced || isReplaySampled(sessionId, policy.threshold))
  );
}

function isGateAllowed(status: IReplayGateStatus): boolean {
  return status.hasController && status.pauseReasons.length === 0;
}

// Privacy backstop on everything this instance sends: only $snapshot events
// of sampled (or QA-forced) sessions, minus anything rrweb emitted while the
// gate was paused, with URLs and text attributes scrubbed.
export function createDesktopReplayBeforeSend({
  policy,
  blockWindows,
}: {
  policy: IReplayPolicy;
  blockWindows: IReplayBlockWindows;
}): BeforeSendFn {
  return (event) => {
    try {
      if (!event || event.event !== '$snapshot') {
        return null;
      }
      const { properties } = event;
      const sessionId: unknown = properties.$session_id;
      if (
        typeof sessionId !== 'string' ||
        !isSessionAllowed(sessionId, policy)
      ) {
        return null;
      }
      const snapshotData: unknown = properties.$snapshot_data;
      if (!Array.isArray(snapshotData)) {
        return null;
      }
      const kept = filterReplaySnapshotData(snapshotData, blockWindows);
      if (kept.length === 0) {
        return null;
      }
      properties.$snapshot_data = kept;
      return event;
    } catch {
      return null;
    }
  };
}

function readPersistedSession(
  instance: PostHog,
): IPersistedReplaySession | undefined {
  const raw: unknown = instance.get_property(SESSION_ID_PROPERTY);
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const [lastActivity, sessionId, startedAt] = raw as unknown[];
  return {
    lastActivity: typeof lastActivity === 'number' ? lastActivity : 0,
    sessionId:
      typeof sessionId === 'string' && sessionId ? sessionId : undefined,
    startedAt: typeof startedAt === 'number' ? startedAt : 0,
  };
}

// Same rules as posthog-js SessionIdManager, read from persisted state only.
// The persisted activity can lag the in-memory one by a few seconds, so this
// may predict a rotation that does not happen, never the other way around.
export function willReplaySessionRotate(
  session: IPersistedReplaySession | undefined,
  timeoutMs: number,
  now: number,
): boolean {
  if (!session?.sessionId) {
    return true;
  }
  if (
    session.lastActivity > 0 &&
    Math.abs(now - session.lastActivity) > timeoutMs
  ) {
    return true;
  }
  return (
    session.startedAt > 0 &&
    Math.abs(now - session.startedAt) > MAX_SESSION_LENGTH_MS
  );
}

function getSessionTimeoutMs(instance: PostHog): number {
  return (
    instance.sessionManager?.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS
  );
}

function createDesktopReplayController({
  instance,
  policy,
  blockWindows,
}: {
  instance: PostHog;
  policy: IReplayPolicy;
  blockWindows: IReplayBlockWindows;
}): IDesktopReplayController & { isTouching: () => boolean } {
  let started = false;
  let touching = false;
  let recorderPromise: Promise<void> | undefined;

  // The bundle registers __PosthogExtensions__.initSessionRecording, so the
  // SDK never tries to fetch lazy-recorder.js from the network.
  const ensureRecorder = (): Promise<void> => {
    recorderPromise ??= import(
      /* webpackChunkName: "posthog-replay-recorder" */ 'posthog-js/dist/posthog-recorder'
    ).then(
      () => undefined,
      (error: unknown) => {
        recorderPromise = undefined;
        throw error;
      },
    );
    return recorderPromise;
  };

  const stopNow = () => {
    blockWindows.open(Date.now());
    started = false;
    instance.stopSessionRecording();
  };

  const startNow = () => {
    blockWindows.close(Date.now());
    started = true;
    // No override argument: an override would bypass posthog's own checks.
    instance.startSessionRecording();
  };

  return {
    platform: 'desktop',
    isTouching: () => touching,
    getSessionId: () => {
      const session = readPersistedSession(instance);
      return willReplaySessionRotate(
        session,
        getSessionTimeoutMs(instance),
        Date.now(),
      )
        ? undefined
        : session?.sessionId;
    },
    touchSession: async () => {
      const { sessionManager } = instance;
      if (!sessionManager) {
        return undefined;
      }
      const before = readPersistedSession(instance);
      const stoppedForRotation =
        started &&
        willReplaySessionRotate(
          before,
          sessionManager.sessionTimeoutMs,
          Date.now(),
        );
      if (stoppedForRotation) {
        stopNow();
      }
      touching = true;
      let sessionId: string;
      try {
        ({ sessionId } = sessionManager.checkAndGetSessionAndWindowId(false));
      } finally {
        touching = false;
      }
      if (
        stoppedForRotation &&
        sessionId === before?.sessionId &&
        isGateAllowed(getReplayGateStatus())
      ) {
        // The guess was wrong and the gate still wants this session recorded.
        startNow();
      }
      return sessionId;
    },
    prepare: ensureRecorder,
    start: async () => {
      await ensureRecorder();
      const { sessionManager } = instance;
      if (!sessionManager || !isGateAllowed(getReplayGateStatus())) {
        return;
      }
      const { sessionId } = sessionManager.checkAndGetSessionAndWindowId(false);
      if (!isSessionAllowed(sessionId, policy)) {
        return;
      }
      startNow();
    },
    stop: async () => {
      stopNow();
    },
    // False while posthog waits for the remote config; the gate retries.
    isRecordingActive: async () =>
      started && instance.sessionRecordingStarted(),
  };
}

type IDesktopReplayContext = {
  controller: IDesktopReplayController;
  policy: IReplayPolicy;
  token: string;
  instanceId: string;
};

let context: IDesktopReplayContext | undefined;
let registered = false;
// Set when a later init asks for a different project or identity. Replay
// stays off until the renderer reloads.
let disabledUntilReload = false;
let initChain: Promise<void> = Promise.resolve();

async function createContext({
  token,
  host,
  instanceId,
}: {
  token: string;
  host: string;
  instanceId: string;
}): Promise<IDesktopReplayContext> {
  const { PostHog: PostHogClass } = await import(
    /* webpackChunkName: "posthog-replay-core" */ 'posthog-js'
  );
  const policy: IReplayPolicy = {
    threshold: REPLAY_SAMPLE_THRESHOLDS.desktop,
    forced: false,
  };
  const blockWindows = createReplayBlockWindows();
  blockWindows.open(Date.now());

  const instance = new PostHogClass();
  instance.init(
    token,
    buildDesktopReplayConfig({
      host,
      instanceId,
      beforeSend: createDesktopReplayBeforeSend({ policy, blockWindows }),
    }),
  );
  // App launch counts as activity: continue or rotate the persisted session
  // before the gate reads it.
  instance.sessionManager?.checkAndGetSessionAndWindowId(false);

  const controller = createDesktopReplayController({
    instance,
    policy,
    blockWindows,
  });

  subscribeReplayGateStatus((status) => {
    if (isGateAllowed(status)) {
      blockWindows.close(Date.now());
    } else {
      blockWindows.open(Date.now());
    }
  });

  // posthog-js also rotates the session on its own (idle timer, user input
  // seen by rrweb). Let the gate re-check the new id; deferred so the gate is
  // never re-entered from inside an SDK callback.
  instance.sessionManager?.onSessionId(
    (_sessionId, _windowId, changeReason) => {
      if (changeReason && !controller.isTouching()) {
        setTimeout(() => {
          notifyReplayActivity();
        }, 0);
      }
    },
  );

  return { controller, policy, token, instanceId };
}

function deactivate(): void {
  if (registered) {
    registered = false;
    unregisterReplayController();
  }
}

async function initSessionReplayInRenderer(
  options: IInitSessionReplayOptions,
): Promise<void> {
  if (!platformEnv.isDesktop || disabledUntilReload) {
    return;
  }
  const enableTestEndpoint = Boolean(options.enableTestEndpoint);
  const { instanceId } = options;
  const { token, host } = getReplayProjectConfig(enableTestEndpoint);
  const buildAllowed =
    !(platformEnv.isDev || platformEnv.isE2E) || enableTestEndpoint;
  if (!buildAllowed || !token || !instanceId) {
    deactivate();
    return;
  }

  if (
    context &&
    (context.token !== token || context.instanceId !== instanceId)
  ) {
    deactivate();
    disabledUntilReload = true;
    return;
  }

  context ??= await createContext({ token, host, instanceId });

  const threshold = REPLAY_SAMPLE_THRESHOLDS.desktop;
  const forced = Boolean(options.forceRecord) && enableTestEndpoint;
  context.policy.threshold = threshold;
  context.policy.forced = forced;
  // Re-registering the same controller only updates threshold and forced.
  registered = true;
  registerReplayController({
    controller: context.controller,
    threshold,
    forced,
  });
}

// Never throws. Calls are serialized; a later call with the same project and
// identity only updates the forced flag.
export async function initSessionReplay(
  options: IInitSessionReplayOptions,
): Promise<void> {
  const run = initChain
    .then(() => initSessionReplayInRenderer(options))
    .catch(() => undefined);
  initChain = run;
  await run;
}
