import {
  type ISharedRPC,
  getSharedRPC,
  getSharedStore,
} from '@onekeyfe/react-native-background-thread';

import { isWebEmbedApiAllowedOrigin } from '@onekeyhq/kit-bg/src/apis/backgroundApiPermissions';
import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerImageEmbedBridge } from '@onekeyhq/shared/src/utils/imageUtils.embedBridge';

import { routeBackgroundMessage } from './backgroundMessageRouter';
import {
  BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY,
  BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY,
  BACKGROUND_THREAD_RESPONSE_KEY_PREFIX,
  type IBackgroundThreadBridgeCallRequest,
  type IBackgroundThreadBridgeChannel,
  type IBackgroundThreadRequest,
  type IBackgroundThreadServiceCallRequest,
  type IBackgroundThreadTransportState,
  WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX,
  buildBackgroundThreadRequestKey,
  buildWebEmbedBridgeResponseKey,
  parseBackgroundThreadAppEventBroadcastPayload,
  parseBackgroundThreadBridgeSendPayload,
  parseBackgroundThreadCallId,
  parseBackgroundThreadJotaiStateBroadcastBatchPayload,
  parseBackgroundThreadJotaiStateBroadcastPayload,
  parseBackgroundThreadResponse,
  serializeBackgroundThreadMainCapabilitiesPayload,
  serializeBackgroundThreadRequest,
} from './rpcProtocol';
import {
  BACKGROUND_THREAD_READY_KEY,
  parseBackgroundThreadRuntimePayload,
} from './runtimeReady';
import { setBackgroundThreadReadyPayload } from './runtimeState';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';

/** Diagnostic logger for the main→background transport layer.
 *  Output goes to app-latest.log via NativeLogger. */
const transportLog = (msg: string) => {
  try {
    NativeLogger.write(LogLevel.Info, `[BgTransport] ${msg}`);
  } catch {
    /* noop */
  }
};

const OBSERVER_RETRY_MS = 50;
const MAX_OBSERVER_RETRY_COUNT = 600;
const READY_TIMEOUT_MS = 10_000;
// Long enough to cover HW + passphrase batch derivation (dozens of BLE
// round-trips, ~1.5 min in practice) plus headroom. A per-call timeout only
// rejects that single call — it no longer tears down the transport.
const REQUEST_TIMEOUT_MS = 10 * 60_000; // 10 minutes
// bridge-calls may wait for user interaction (e.g. DApp connect modal),
// so they need a much longer timeout and should NOT break the transport.
const BRIDGE_CALL_TIMEOUT_MS = 10 * 60_000; // 10 minutes
// Caps the number of SIMULTANEOUSLY in-flight (awaiting-response) main→bg
// requests, not throughput — each id frees the moment its response resolves.
// Raised from 512 to give headroom for the all-network home cascade (dozens of
// networks × many token/balance/history calls fanning out concurrently), where
// the previous ceiling could be approached and exhausting it hard-rejects a
// call. The id space is a sparse Map, so unused slots cost nothing.
const MAX_REMOTE_CALL_SLOT_COUNT = 8192;

type IQueuedCall = {
  request: IBackgroundThreadRequest;
  localFallback: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
};

type IPendingRemoteCall = {
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  localFallback: () => Promise<any>;
};

type INativeBackgroundThreadTransport = {
  callServiceRequest: (
    request: IBackgroundThreadServiceCallRequest,
    localFallback: () => Promise<any>,
  ) => Promise<any>;
  emitAppEventRequest: (
    request: {
      type: 'app-event';
      eventName: string;
      payload: unknown;
      originNodeId?: string;
    },
    localFallback: () => Promise<any>,
  ) => Promise<any>;
  callBridgeRequest: (
    request: IBackgroundThreadBridgeCallRequest,
    localFallback: () => Promise<any>,
  ) => Promise<any>;
  syncBridgeConnection: (
    params: {
      channel: IBackgroundThreadBridgeChannel;
      bridge: JsBridgeBase | null;
    },
    localFallback: () => Promise<any>,
  ) => Promise<any>;
  ensureReady: () => Promise<void>;
  getState: () => IBackgroundThreadTransportState;
  isEnabled: () => boolean;
};

type IBackgroundThreadTransportGlobal = typeof globalThis & {
  __onekeyNativeBackgroundThreadTransport?: INativeBackgroundThreadTransport;
};

let observerRetryCount = 0;
let observerRetryTimer: ReturnType<typeof setTimeout> | undefined;
let observerInstalled = false;
let readyTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
let requestSequence = 0;
// Peak count of simultaneously in-flight main→bg requests (observability +
// MAX_REMOTE_CALL_SLOT_COUNT sizing signal). Monotonically increasing.
let maxInFlightRemoteCalls = 0;
let transportState: IBackgroundThreadTransportState = 'idle';
let queuedFlushPromise: Promise<void> | undefined;
let remoteBrokenReason: string | undefined;

// Startup timing milestones (ms since JS entry)
const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();
let transportStartingAt = 0;
let transportReadyAt = 0;

const queuedCalls: IQueuedCall[] = [];
const pendingRemoteCalls = new Map<string, IPendingRemoteCall>();
const mainThreadBridgeMap: Partial<
  Record<IBackgroundThreadBridgeChannel, JsBridgeBase | null>
> = {};

function isNativeBackgroundThreadTransportEnabled() {
  return Boolean(
    platformEnv.isNativeMainThread && platformEnv.enableNativeBackgroundThread,
  );
}

function createTransportError(message: string) {
  return new OneKeyLocalError(message);
}

function getTransportGlobal() {
  return globalThis as IBackgroundThreadTransportGlobal;
}

function clearReadyTimeoutTimer() {
  if (!readyTimeoutTimer) {
    return;
  }
  clearTimeout(readyTimeoutTimer);
  readyTimeoutTimer = undefined;
}

function rejectQueuedCalls(reason: string) {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  const error = createTransportError(reason);
  queuedCallsSnapshot.forEach(({ reject }) => {
    reject(error);
  });
}

function getRemoteBrokenReason(reason?: string) {
  return (
    remoteBrokenReason || reason || 'Background runtime unavailable after ready'
  );
}

function switchToRemoteBroken(reason: string) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return false;
  }
  if (transportState === 'remote-broken') {
    return false;
  }

  remoteBrokenReason = reason;
  transportState = 'remote-broken';
  clearReadyTimeoutTimer();
  rejectQueuedCalls(reason);

  const pendingRemoteCallsSnapshot = Array.from(pendingRemoteCalls.values());
  pendingRemoteCalls.clear();
  const error = createTransportError(reason);
  pendingRemoteCallsSnapshot.forEach(({ reject, timer }) => {
    clearTimeout(timer);
    reject(error);
  });
  return true;
}

function ensureReadyTimeout() {
  if (readyTimeoutTimer || transportState !== 'starting') {
    return;
  }

  readyTimeoutTimer = setTimeout(() => {
    readyTimeoutTimer = undefined;
    switchToRemoteBroken('Background runtime ready timeout');
  }, READY_TIMEOUT_MS);
}

function cleanupPendingRemoteCall(callId: string) {
  const pendingCall = pendingRemoteCalls.get(callId);
  if (!pendingCall) {
    return undefined;
  }

  clearTimeout(pendingCall.timer);
  pendingRemoteCalls.delete(callId);
  return pendingCall;
}

function createRemoteCallId() {
  for (let attempt = 0; attempt < MAX_REMOTE_CALL_SLOT_COUNT; attempt += 1) {
    requestSequence = (requestSequence + 1) % MAX_REMOTE_CALL_SLOT_COUNT;
    const callId = `${requestSequence}`;
    if (!pendingRemoteCalls.has(callId)) {
      return callId;
    }
  }

  throw createTransportError('Too many pending background requests');
}

function getRequestDebugLabel(request: IBackgroundThreadRequest) {
  switch (request.type) {
    case 'service-call':
      return `service-call:${request.method}`;
    case 'bridge-call':
      return `bridge-call:${request.payload.scope || 'unknown-scope'}`;
    case 'bridge-connect':
      return `bridge-connect:${request.channel}`;
    case 'app-event':
      return `app-event:${request.eventName}`;
    default:
      return 'unknown-request';
  }
}

function dispatchRemoteRequest(
  request: IBackgroundThreadRequest,
  localFallback: () => Promise<any>,
) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return localFallback();
  }
  if (transportState === 'remote-broken') {
    throw createTransportError(getRemoteBrokenReason());
  }

  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    const reason =
      transportState === 'ready'
        ? 'SharedRPC unavailable after background runtime ready'
        : 'SharedRPC unavailable in main runtime';
    switchToRemoteBroken(reason);
    throw createTransportError(getRemoteBrokenReason(reason));
  }

  const callId = createRemoteCallId();
  const requestKey = buildBackgroundThreadRequestKey(callId);
  transportLog(
    `dispatchRemoteRequest: callId=${callId}, type=${request.type}, method=${'method' in request ? request.method : 'N/A'}`,
  );
  const isBridgeCall = request.type === 'bridge-call';
  const timeoutMs = isBridgeCall ? BRIDGE_CALL_TIMEOUT_MS : REQUEST_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pendingRemoteCalls.has(callId)) {
        return;
      }
      transportLog(`dispatchRemoteRequest TIMEOUT: callId=${callId}`);
      // A single slow call (e.g. batch account derivation that legitimately
      // runs past REQUEST_TIMEOUT_MS) must NOT tear down the whole main↔bg
      // transport. Reject only this pending call; keep transport alive so
      // subsequent RPCs still reach the background runtime.
      const pending = pendingRemoteCalls.get(callId);
      pendingRemoteCalls.delete(callId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(
          createTransportError(
            isBridgeCall
              ? `Bridge call timeout (${timeoutMs / 1000}s). request=${getRequestDebugLabel(request)}`
              : `Background request timeout (${timeoutMs / 1000}s). request=${getRequestDebugLabel(request)}`,
          ),
        );
      }
    }, timeoutMs);

    pendingRemoteCalls.set(callId, {
      resolve,
      reject,
      timer,
      localFallback,
    });

    // Observability replacement for the removed native `pendingCount`: track
    // the peak number of SIMULTANEOUSLY in-flight main→bg requests. This both
    // surfaces "consumer falling behind" pressure and gives the real peak to
    // size MAX_REMOTE_CALL_SLOT_COUNT against (see its definition).
    if (pendingRemoteCalls.size > maxInFlightRemoteCalls) {
      maxInFlightRemoteCalls = pendingRemoteCalls.size;
      transportLog(
        `in-flight remote calls peak=${maxInFlightRemoteCalls}/${MAX_REMOTE_CALL_SLOT_COUNT}`,
      );
    }

    sharedRPC.write(requestKey, serializeBackgroundThreadRequest(request));
  });
}

function dispatchQueuedCallsToRemote() {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  transportLog(
    `dispatchQueuedCallsToRemote: ${queuedCallsSnapshot.length} calls`,
  );
  if (!queuedCallsSnapshot.length) {
    return;
  }

  queuedFlushPromise = queuedCallsSnapshot
    .reduce<Promise<void>>((promise, queuedCall) => {
      return promise.finally(async () => {
        try {
          const result = await dispatchRemoteRequest(
            queuedCall.request,
            queuedCall.localFallback,
          );
          queuedCall.resolve(result);
        } catch (error) {
          queuedCall.reject(error);
        }
      });
    }, Promise.resolve())
    .finally(() => {
      queuedFlushPromise = undefined;
    });
}

function handleRuntimeSignal() {
  transportLog(`handleRuntimeSignal called, transportState=${transportState}`);
  // Readiness is latched in SharedStore (non-deleting `get`), not the SharedRPC
  // message path. The wake ping (BACKGROUND_THREAD_READY_WAKE_KEY) only edge-
  // triggers this re-read; the actual payload lives here and survives restarts
  // until cleared by the native invalidate path.
  const runtimePayload = parseBackgroundThreadRuntimePayload(
    getSharedStore()?.get(BACKGROUND_THREAD_READY_KEY),
  );

  if (!runtimePayload) {
    return;
  }

  if (runtimePayload.status === 'failed') {
    const reason =
      runtimePayload.errorMessage || 'Background runtime init failed';
    switchToRemoteBroken(reason);
    return;
  }

  if (transportState === 'ready') {
    return;
  }

  // Allow recovery from remote-broken: if the background runtime
  // signals ready again (e.g. after a transient failure), transition
  // back to ready state (#35).
  remoteBrokenReason = undefined;
  transportState = 'ready';
  transportReadyAt = Date.now();
  const readyFromEntry = transportReadyAt - jsEntryStart;
  const readyFromStarting = transportStartingAt
    ? transportReadyAt - transportStartingAt
    : 0;
  transportLog(
    `transport → ready at +${readyFromEntry}ms from JS entry (starting→ready: ${readyFromStarting}ms, observer retries: ${observerRetryCount})`,
  );
  clearReadyTimeoutTimer();
  setBackgroundThreadReadyPayload(runtimePayload);
  dispatchQueuedCallsToRemote();
}

function handleBackgroundThreadResponse(
  key: string,
  value: string | number | boolean,
) {
  const callId = parseBackgroundThreadCallId(
    key,
    BACKGROUND_THREAD_RESPONSE_KEY_PREFIX,
  );
  if (!callId) {
    return;
  }

  const pendingCall = pendingRemoteCalls.get(callId);
  if (!pendingCall) {
    transportLog(`handleResponse: callId=${callId} no pending call`);
    return;
  }

  const response = parseBackgroundThreadResponse(value);
  transportLog(
    `handleResponse: callId=${callId}, ok=${response?.ok}, error=${response?.error ? JSON.stringify(response.error).slice(0, 300) : 'none'}`,
  );
  if (!response) {
    switchToRemoteBroken(
      `Invalid background response payload. callId=${callId}`,
    );
    return;
  }

  cleanupPendingRemoteCall(callId);

  if (response.ok) {
    pendingCall.resolve(response.result);
    return;
  }

  const errorInfo = response.error;
  const error = createTransportError(
    errorInfo?.message ||
      `Background request failed without error payload. callId=${callId}`,
  ) as Error & {
    name?: string;
    stack?: string;
    autoToast?: boolean;
    className?: string;
    code?: string | number;
    key?: string;
    requestId?: string;
    httpStatusCode?: number;
    constructorName?: string;
    payload?: unknown;
  };
  if (errorInfo?.name) {
    error.name = errorInfo.name;
  }
  if (errorInfo?.stack) {
    error.stack = errorInfo.stack;
  }
  // Rehydrate OneKeyError metadata stripped by JSON RPC so downstream
  // toast / i18n / dedup logic behaves the same as non-split thread mode.
  if (typeof errorInfo?.autoToast === 'boolean') {
    error.autoToast = errorInfo.autoToast;
  }
  if (typeof errorInfo?.className === 'string') {
    error.className = errorInfo.className;
  }
  if (
    typeof errorInfo?.code === 'string' ||
    typeof errorInfo?.code === 'number'
  ) {
    error.code = errorInfo.code;
  }
  if (typeof errorInfo?.key === 'string') {
    error.key = errorInfo.key;
  }
  if (typeof errorInfo?.requestId === 'string') {
    error.requestId = errorInfo.requestId;
  }
  if (typeof errorInfo?.httpStatusCode === 'number') {
    error.httpStatusCode = errorInfo.httpStatusCode;
  }
  if (typeof errorInfo?.constructorName === 'string') {
    error.constructorName = errorInfo.constructorName;
  }
  if (errorInfo?.payload !== undefined) {
    error.payload = errorInfo.payload;
  }
  pendingCall.reject(error);
}

function handleBackgroundThreadJotaiStateUpdate(
  value: string | number | boolean,
) {
  const payload = parseBackgroundThreadJotaiStateBroadcastPayload(value);
  if (!payload) {
    return;
  }

  void jotaiUpdateFromUiByBgBroadcast({
    $$isFromBgStatesSyncBroadcast: true,
    name: payload.name,
    payload: payload.payload,
  });
}

/**
 * Apply a batched jotai broadcast. Bg side coalesces same-microtask atom
 * writes into one SharedRPC slot to keep main JS thread task pressure low
 * during cascade bursts. Items are iterated in insertion order so derived
 * subscribers observe values in the same order as if each item had been
 * delivered via the single-broadcast path.
 */
function handleBackgroundThreadJotaiStateBatchUpdate(
  value: string | number | boolean,
) {
  const payload = parseBackgroundThreadJotaiStateBroadcastBatchPayload(value);
  if (!payload) {
    return;
  }

  for (const item of payload.items) {
    void jotaiUpdateFromUiByBgBroadcast({
      $$isFromBgStatesSyncBroadcast: true,
      name: item.name,
      payload: item.payload,
    });
  }
}

function handleBackgroundThreadAppEventUpdate(
  value: string | number | boolean,
) {
  const payload = parseBackgroundThreadAppEventBroadcastPayload(value);
  if (!payload) {
    return;
  }

  // We are the main-thread foreground receiving a broadcast from the
  // background. Route through dispatchInboundFromBackground so we skip our
  // own echoes via originNodeId.
  appEventBus.dispatchInboundFromBackground({
    type: payload.eventName,
    payload: payload.payload,
    originNodeId: payload.originNodeId ?? '',
  });
}

function handleBackgroundThreadBridgeSend(value: string | number | boolean) {
  const payload = parseBackgroundThreadBridgeSendPayload(value);
  if (!payload) {
    return;
  }

  const bridge = mainThreadBridgeMap[payload.channel];
  if (!bridge || !bridge.globalOnMessageEnabled) {
    return;
  }

  const bridgeOrigin = bridge.remoteInfo?.origin;
  if (
    payload.targetOrigin &&
    bridgeOrigin &&
    payload.targetOrigin !== bridgeOrigin
  ) {
    return;
  }

  bridge.requestSync({
    scope: payload.scope,
    data: payload.data,
  });
}

async function handleWebEmbedBridgeRequest(
  sharedRPC: ISharedRPC,
  key: string,
  value: string | number | boolean,
) {
  const callId = key.slice(WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX.length);
  const responseKey = buildWebEmbedBridgeResponseKey(callId);

  try {
    const data = typeof value === 'string' ? JSON.parse(value) : undefined;
    const bridge = mainThreadBridgeMap.webEmbed;

    if (!bridge) {
      sharedRPC.write(
        responseKey,
        JSON.stringify({
          ok: false,
          error: { message: 'webEmbed bridge not available in main thread' },
        }),
      );
      return;
    }

    const result = await bridge.request({ scope: '$private', data });
    sharedRPC.write(responseKey, JSON.stringify({ ok: true, result }));
  } catch (error) {
    sharedRPC.write(
      responseKey,
      JSON.stringify({
        ok: false,
        error: { message: String((error as Error)?.message || error) },
      }),
    );
  }
}

function installBackgroundRuntimeObserver(sharedRPC: ISharedRPC) {
  if (!observerInstalled) {
    observerInstalled = true;
    // Value-inline messaging: the native notify callback delivers BOTH the
    // `callId` and the payload `value`, so handlers consume the inline value
    // directly — no read-back. The paired native (3.0.45) and `ISharedRPC`
    // both carry the `(callId, value)` form.
    sharedRPC.onWrite((callId, value) => {
      routeBackgroundMessage(
        {
          onReadySignal: () => handleRuntimeSignal(),
          onResponse: handleBackgroundThreadResponse,
          onJotaiStateBatch: (_callId, v) =>
            handleBackgroundThreadJotaiStateBatchUpdate(v),
          onJotaiState: (_callId, v) =>
            handleBackgroundThreadJotaiStateUpdate(v),
          onAppEvent: (_callId, v) => handleBackgroundThreadAppEventUpdate(v),
          onBridgeSend: (_callId, v) => handleBackgroundThreadBridgeSend(v),
          onWebEmbedRequest: (callIdKey, v) =>
            void handleWebEmbedBridgeRequest(sharedRPC, callIdKey, v),
        },
        callId,
        value,
      );
    });

    // Restart freshness (§4.6): tell native which SharedStore key this (main)
    // runtime owns, so the native invalidate("main") path clears it on
    // teardown and a restarted bg never reads a prior-life main-up.
    sharedRPC.registerReadinessKey(BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY);

    // Advertise that this main runtime knows how to consume opt-in wire
    // protocols (batched jotai broadcasts at the moment), and signal "main is
    // up". The capability payload is latched in SharedStore (bg reads it
    // synchronously); a content-less wake ping on SharedRPC edge-wakes bg to
    // re-read it. Bg only switches to the new protocols after observing the
    // bit, so a mismatch falls back to the legacy `onekey:bg:jotai:` keys.
    try {
      const sharedStore = getSharedStore();
      sharedStore?.set(
        BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY,
        serializeBackgroundThreadMainCapabilitiesPayload({
          jotaiStateBatch: true,
        }),
      );
      sharedRPC.write(BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY, '1');
    } catch (error) {
      transportLog(
        `failed to advertise main capabilities: ${(error as Error)?.message || String(error)}`,
      );
    }
  }

  if (transportState === 'idle') {
    transportState = 'starting';
    transportStartingAt = Date.now();
    transportLog(
      `transport → starting at +${transportStartingAt - jsEntryStart}ms from JS entry`,
    );
  }

  ensureReadyTimeout();
  handleRuntimeSignal();
}

function ensureBackgroundRuntimeObserver() {
  transportLog(
    `ensureObserver: enabled=${isNativeBackgroundThreadTransportEnabled()}, transportState=${transportState}, retryCount=${observerRetryCount}`,
  );
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return;
  }

  const sharedRPC = getSharedRPC();
  if (sharedRPC) {
    installBackgroundRuntimeObserver(sharedRPC);
    return;
  }

  if (observerRetryTimer || observerRetryCount >= MAX_OBSERVER_RETRY_COUNT) {
    if (observerRetryCount >= MAX_OBSERVER_RETRY_COUNT) {
      switchToRemoteBroken('SharedRPC unavailable in main runtime');
    }
    return;
  }

  if (transportState === 'idle') {
    transportState = 'starting';
    transportStartingAt = Date.now();
    transportLog(
      `transport → starting (retry path) at +${transportStartingAt - jsEntryStart}ms from JS entry`,
    );
    ensureReadyTimeout();
  }

  observerRetryTimer = setTimeout(() => {
    observerRetryTimer = undefined;
    observerRetryCount += 1;
    ensureBackgroundRuntimeObserver();
  }, OBSERVER_RETRY_MS);
}

async function ensureTransportReady() {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    throw createTransportError('Native background thread transport disabled');
  }

  ensureBackgroundRuntimeObserver();
  const waitUntil = Date.now() + READY_TIMEOUT_MS;

  while (transportState !== 'ready') {
    if (transportState === 'remote-broken') {
      throw createTransportError(getRemoteBrokenReason());
    }

    if (Date.now() >= waitUntil) {
      const reason = 'Background runtime ready timeout';
      switchToRemoteBroken(reason);
      throw createTransportError(getRemoteBrokenReason(reason));
    }

    await new Promise((resolve) => {
      setTimeout(resolve, OBSERVER_RETRY_MS);
    });
    ensureBackgroundRuntimeObserver();
  }
}

function callRemoteRequest(
  request: IBackgroundThreadRequest,
  localFallback: () => Promise<any>,
) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return localFallback();
  }

  if (transportState === 'remote-broken') {
    return Promise.reject(createTransportError(getRemoteBrokenReason()));
  }

  if (transportState === 'ready') {
    transportLog(
      `callRemoteRequest: ready, queuedFlushPromise=${!!queuedFlushPromise}, type=${request.type}, method=${'method' in request ? request.method : 'N/A'}`,
    );
    if (queuedFlushPromise) {
      return queuedFlushPromise.then(() =>
        dispatchRemoteRequest(request, localFallback),
      );
    }
    return dispatchRemoteRequest(request, localFallback);
  }

  transportLog(
    `callRemoteRequest: queuing, transportState=${transportState}, type=${request.type}`,
  );

  // Push to queue BEFORE installing observer. ensureBackgroundRuntimeObserver may
  // synchronously trigger handleRuntimeSignal → dispatchQueuedCallsToRemote,
  // so the call must already be in the queue when that happens.
  const promise = new Promise((resolve, reject) => {
    queuedCalls.push({
      request,
      localFallback,
      resolve,
      reject,
    });
  });

  ensureBackgroundRuntimeObserver();

  return promise;
}

function callServiceRequest(
  request: IBackgroundThreadServiceCallRequest,
  localFallback: () => Promise<any>,
) {
  return callRemoteRequest(request, localFallback);
}

function callBridgeRequest(
  request: IBackgroundThreadBridgeCallRequest,
  localFallback: () => Promise<any>,
) {
  return callRemoteRequest(request, localFallback);
}

function emitAppEventRequest(
  request: {
    type: 'app-event';
    eventName: string;
    payload: unknown;
    originNodeId?: string;
  },
  localFallback: () => Promise<any>,
) {
  return callRemoteRequest(request, localFallback);
}

const WEBEMBED_BRIDGE_READY_TIMEOUT_MS = 30 * 1000;

// Local readiness has TWO independent components and the gate must require
// BOTH:
//   (a) page-side JS handshake done — `webEmbedReady`, set by
//       `LoadWebEmbedWebViewComplete` (re-emitted by BG after the page sent
//       `webEmbedApiReady`) or by `checkBackgroundWebEmbedReady` falling back
//       to BG's canonical `serviceDApp.isWebEmbedApiReady` flag.
//   (b) main thread holds the JsBridge — `mainThreadBridgeMap.webEmbed`,
//       populated by `syncBridgeConnection` when `connectWebEmbedBridge`
//       runs on the WebView host.
// Normal first-mount populates (b) before (a), so the BG flag and (b)
// converge naturally. But across WebView re-mounts, or whenever BG's
// `isWebEmbedApiReady` is ahead of main's transport sync (event missed,
// listener not yet installed, etc.), (a) and (b) can drift. If we only
// gated on (a), the next call would skip waiting and crash with
// `webEmbed bridge not available on main thread`.
let webEmbedReady = false;
// Bumped on every webEmbed teardown (null bridge sync). Used by
// `checkBackgroundWebEmbedReady` to discard a BG `true` read whose RPC was
// in flight across the unmount → next-mount boundary, so the stale flag
// can't promote (a) for a page that hasn't actually replayed its handshake.
let webEmbedMountGeneration = 0;
// BG canonical `isWebEmbedApiReady` is only authoritative when we know the
// flag belongs to the live mount. After a teardown, BG's `markWebEmbedApi
// NotReady` is fire-and-forget (see `WebViewWebEmbed/index.tsx`), so for a
// window between disconnect and BG actually clearing its flag, BG can still
// report the previous mount's stale `true`. The mount-generation guard
// only catches a teardown that happens *during* the BG RPC; it does NOT
// catch the case where the next-mount call fires entirely *after* a
// teardown, before BG has finished resetting. Disable the BG fallback
// path on every teardown, and re-enable only when `LoadWebEmbedWebView
// Complete` arrives — that event is BG-relayed *after* the new page sent
// `webEmbedApiReady`, so once we observe it BG's flag is fresh again.
let webEmbedBgFallbackEnabled = true;
const webEmbedReadyWaiters: Array<() => void> = [];

function isMainThreadWebEmbedReady(): boolean {
  return webEmbedReady && Boolean(mainThreadBridgeMap.webEmbed);
}

function flushWebEmbedReadyWaiters() {
  if (!isMainThreadWebEmbedReady()) return;
  webEmbedReadyWaiters.splice(0).forEach((cb) => cb());
}

function syncBridgeConnection(
  params: {
    channel: IBackgroundThreadBridgeChannel;
    bridge: JsBridgeBase | null;
  },
  localFallback: () => Promise<any>,
) {
  mainThreadBridgeMap[params.channel] = params.bridge;
  if (params.channel === 'webEmbed') {
    if (params.bridge) {
      // Bridge just came up — if BG-reported `webEmbedReady` already arrived
      // ahead of the transport sync, release any waiters now that gate (b)
      // is satisfied. `flushWebEmbedReadyWaiters` no-ops when (a) is still
      // false, so this is safe to call unconditionally.
      flushWebEmbedReadyWaiters();
    } else {
      // No live webEmbed bridge — reset (a) unconditionally. We must NOT gate
      // this on a previous bridge, because `checkBackgroundWebEmbedReady`
      // can flip (a) true from BG's canonical flag *before* main has ever
      // received a bridge. If we then ignored the null sync, a later mount
      // whose bridge syncs ahead of its own `webEmbedApiReady` would see
      // stale (a)=true + fresh (b)=true and `isMainThreadWebEmbedReady`
      // would falsely release, dispatching imageUtils calls to a not-yet-
      // ready page. Resetting on every null sync forces the next caller to
      // re-validate via BG and wait for the new ready signal.
      webEmbedReady = false;
      webEmbedMountGeneration += 1;
      webEmbedBgFallbackEnabled = false;
    }
  }
  return callRemoteRequest(
    {
      type: 'bridge-connect',
      channel: params.channel,
      connected: Boolean(params.bridge),
      origin: params.bridge?.remoteInfo?.origin,
      globalOnMessageEnabled: Boolean(params.bridge?.globalOnMessageEnabled),
    },
    localFallback,
  );
}

function installGlobalTransport() {
  getTransportGlobal().__onekeyNativeBackgroundThreadTransport = {
    callServiceRequest,
    emitAppEventRequest,
    callBridgeRequest,
    syncBridgeConnection,
    ensureReady: ensureTransportReady,
    getState: () => transportState,
    isEnabled: isNativeBackgroundThreadTransportEnabled,
  };
}

appEventBus.on(EAppEventBusNames.LoadWebEmbedWebViewComplete, () => {
  webEmbedReady = true;
  // BG re-emits this event only *after* the live page sent
  // `webEmbedApiReady`, which means BG's canonical flag has been updated
  // for the current mount. Re-arm the fallback so post-teardown callers
  // can use it again.
  webEmbedBgFallbackEnabled = true;
  flushWebEmbedReadyWaiters();
});

// Backstop for the (rare) case where main missed the broadcasted
// `LoadWebEmbedWebViewComplete` — e.g. event fired before our cross-thread
// observer was wired, or some future refactor delays observer install. Ask
// BG for the canonical `isWebEmbedApiReady` flag once, and if BG says ready
// we mark local (a) ready. Whether the gate releases still depends on (b)
// — see `isMainThreadWebEmbedReady`.
async function checkBackgroundWebEmbedReady(): Promise<boolean> {
  // Skip BG fallback if a teardown has happened and no fresh
  // `LoadWebEmbedWebViewComplete` has arrived yet — BG's flag may still
  // hold the previous mount's stale `true`. Callers fall back to the
  // event-wait path; the next-mount event will set ready directly.
  if (!webEmbedBgFallbackEnabled) return false;
  // Capture the mount generation *before* the cross-thread fetch. If a
  // teardown happens while the RPC is in flight, the BG `true` we read
  // belongs to the previous mount — promoting it would race a fresh mount
  // whose page hasn't replayed `webEmbedApiReady` yet.
  const generationAtStart = webEmbedMountGeneration;
  try {
    const bgApiProxy = appGlobals?.$backgroundApiProxy;
    const ready = await bgApiProxy?.serviceDApp?.isWebEmbedApiReady?.();
    if (
      ready &&
      webEmbedMountGeneration === generationAtStart &&
      webEmbedBgFallbackEnabled
    ) {
      webEmbedReady = true;
      flushWebEmbedReadyWaiters();
      return isMainThreadWebEmbedReady();
    }
  } catch {
    // RPC failed (transport not yet up, or BG side error). Fall through to
    // event-wait path; it'll either succeed when the event arrives or time
    // out with a clear error.
  }
  return false;
}

async function awaitWebEmbedReady(timeoutMs: number): Promise<void> {
  if (isMainThreadWebEmbedReady()) return;
  if (await checkBackgroundWebEmbedReady()) return;
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const idx = webEmbedReadyWaiters.indexOf(onReady);
      if (idx !== -1) webEmbedReadyWaiters.splice(idx, 1);
      reject(
        new OneKeyLocalError(`webEmbed not ready after ${timeoutMs / 1000}s`),
      );
    }, timeoutMs);
    webEmbedReadyWaiters.push(onReady);
    // Cover the race where either signal flipped between our gate check at
    // the top of this function and the listener push above.
    if (isMainThreadWebEmbedReady()) {
      const idx = webEmbedReadyWaiters.indexOf(onReady);
      if (idx !== -1) webEmbedReadyWaiters.splice(idx, 1);
      clearTimeout(timer);
      resolve();
    }
  });
}

async function ensureMainThreadWebEmbedBridge(): Promise<JsBridgeBase> {
  if (!isMainThreadWebEmbedReady()) {
    // Trigger WebView mount if it hasn't been requested yet — bridge being
    // unset is a strong hint, but emit unconditionally because the event
    // handler in WebViewWebEmbedProvider is idempotent.
    if (!mainThreadBridgeMap.webEmbed) {
      appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
    }
    await awaitWebEmbedReady(WEBEMBED_BRIDGE_READY_TIMEOUT_MS);
  }
  const bridge = mainThreadBridgeMap.webEmbed;
  if (!bridge) {
    throw new OneKeyLocalError('webEmbed bridge not available on main thread');
  }
  const origin = bridge.remoteInfo?.origin || '';
  if (!isWebEmbedApiAllowedOrigin(origin)) {
    throw new OneKeyLocalError(
      `webEmbed callImageUtils not allowed origin: ${origin || 'undefined'}`,
    );
  }
  return bridge;
}

async function callMainThreadWebEmbedImageUtils<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  const bridge = await ensureMainThreadWebEmbedBridge();
  const result = await bridge.request({
    scope: '$private',
    data: { module: 'imageUtils', method, params },
  });
  return result as T;
}

function registerMainThreadImageEmbedBridge() {
  registerImageEmbedBridge({
    convertToBlackAndWhiteImageBase64: (img, mime) =>
      callMainThreadWebEmbedImageUtils<string>(
        'convertToBlackAndWhiteImageBase64',
        [img, mime],
      ),
    applyRoundedCorners: (params) =>
      callMainThreadWebEmbedImageUtils<string>('applyRoundedCorners', [params]),
    base64ImageToBitmap: (params) =>
      callMainThreadWebEmbedImageUtils<string>('base64ImageToBitmap', [params]),
    processImageBlur: (params) =>
      callMainThreadWebEmbedImageUtils<{
        hex: string;
        width: number;
        height: number;
      }>('processImageBlur', [params]),
  });
}

/** Expose startup milestones for the timing summary log. */
export function getTransportTimingMilestones() {
  return {
    jsEntryStart,
    transportStartingAt,
    transportReadyAt,
  };
}

export function setupMainThreadBackgroundRunner() {
  installGlobalTransport();
  ensureBackgroundRuntimeObserver();
  // Only register on dual-thread native main: in single-thread native the
  // BG-side webembedApiProxy.ts already registers a serviceDApp-routed
  // adapter and `mainThreadBridgeMap` would be empty here. In dual-thread
  // mode the WebView lives on this thread, so we can call the local bridge
  // directly and skip the main → BG → main round-trip.
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    registerMainThreadImageEmbedBridge();
  }
}

setupMainThreadBackgroundRunner();
