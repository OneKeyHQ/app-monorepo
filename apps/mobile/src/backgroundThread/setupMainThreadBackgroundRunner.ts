import {
  type ISharedRPC,
  getSharedRPC,
} from '@onekeyfe/react-native-background-thread';

import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX,
  BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX,
  BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX,
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
  parseBackgroundThreadJotaiStateBroadcastPayload,
  parseBackgroundThreadResponse,
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
const MAX_REMOTE_CALL_SLOT_COUNT = 512;

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

function ensureReadyTimeout() {
  if (readyTimeoutTimer || transportState !== 'starting') {
    return;
  }

  readyTimeoutTimer = setTimeout(() => {
    readyTimeoutTimer = undefined;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

function rejectQueuedCalls(reason: string) {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  const error = createTransportError(reason);
  queuedCallsSnapshot.forEach(({ reject }) => {
    reject(error);
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
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

function handleRuntimeSignal(sharedRPC: ISharedRPC) {
  transportLog(`handleRuntimeSignal called, transportState=${transportState}`);
  const runtimePayload = parseBackgroundThreadRuntimePayload(
    sharedRPC.read(BACKGROUND_THREAD_READY_KEY),
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

function handleBackgroundThreadResponse(sharedRPC: ISharedRPC, key: string) {
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

  const response = parseBackgroundThreadResponse(sharedRPC.read(key));
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
  pendingCall.reject(error);
}

function handleBackgroundThreadJotaiStateUpdate(
  sharedRPC: ISharedRPC,
  key: string,
) {
  const payload = parseBackgroundThreadJotaiStateBroadcastPayload(
    sharedRPC.read(key),
  );
  if (!payload) {
    return;
  }

  void jotaiUpdateFromUiByBgBroadcast({
    $$isFromBgStatesSyncBroadcast: true,
    name: payload.name,
    payload: payload.payload,
  });
}

function handleBackgroundThreadAppEventUpdate(
  sharedRPC: ISharedRPC,
  key: string,
) {
  const payload = parseBackgroundThreadAppEventBroadcastPayload(
    sharedRPC.read(key),
  );
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

function handleBackgroundThreadBridgeSend(sharedRPC: ISharedRPC, key: string) {
  const payload = parseBackgroundThreadBridgeSendPayload(sharedRPC.read(key));
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

async function handleWebEmbedBridgeRequest(sharedRPC: ISharedRPC, key: string) {
  const callId = key.slice(WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX.length);
  const responseKey = buildWebEmbedBridgeResponseKey(callId);

  try {
    const raw = sharedRPC.read(key);
    const data = typeof raw === 'string' ? JSON.parse(raw) : undefined;
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
    sharedRPC.onWrite((callId) => {
      if (callId === BACKGROUND_THREAD_READY_KEY) {
        handleRuntimeSignal(sharedRPC);
        return;
      }

      if (callId.startsWith(BACKGROUND_THREAD_RESPONSE_KEY_PREFIX)) {
        handleBackgroundThreadResponse(sharedRPC, callId);
        return;
      }

      if (callId.startsWith(BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX)) {
        handleBackgroundThreadJotaiStateUpdate(sharedRPC, callId);
        return;
      }

      if (callId.startsWith(BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX)) {
        handleBackgroundThreadAppEventUpdate(sharedRPC, callId);
        return;
      }

      if (callId.startsWith(BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX)) {
        handleBackgroundThreadBridgeSend(sharedRPC, callId);
        return;
      }

      if (callId.startsWith(WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX)) {
        void handleWebEmbedBridgeRequest(sharedRPC, callId);
      }
    });
  }

  if (transportState === 'idle') {
    transportState = 'starting';
    transportStartingAt = Date.now();
    transportLog(
      `transport → starting at +${transportStartingAt - jsEntryStart}ms from JS entry`,
    );
  }

  ensureReadyTimeout();
  handleRuntimeSignal(sharedRPC);
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

    sharedRPC.write(requestKey, serializeBackgroundThreadRequest(request));
  });
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

function syncBridgeConnection(
  params: {
    channel: IBackgroundThreadBridgeChannel;
    bridge: JsBridgeBase | null;
  },
  localFallback: () => Promise<any>,
) {
  mainThreadBridgeMap[params.channel] = params.bridge;
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
}

setupMainThreadBackgroundRunner();
