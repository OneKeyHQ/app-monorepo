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
  buildBackgroundThreadRequestKey,
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
const REQUEST_TIMEOUT_MS = 30_000;
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
    switchToFallbackLocal('Background runtime ready timeout');
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

function flushQueuedCallsToLocal() {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  queuedCallsSnapshot.forEach(({ localFallback, resolve, reject }) => {
    void localFallback().then(resolve).catch(reject);
  });
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

function switchToFallbackLocal(reason: string) {
  transportLog(
    `switchToFallbackLocal: reason=${reason}, transportState=${transportState}, queuedCalls=${queuedCalls.length}`,
  );
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return false;
  }
  if (
    transportState === 'ready' ||
    transportState === 'remote-broken' ||
    transportState === 'fallback-local'
  ) {
    return false;
  }

  console.warn(
    `[BG_TRANSPORT] switchToFallbackLocal: reason=${reason} queuedCalls=${queuedCalls.length}`,
  );
  transportState = 'fallback-local';
  clearReadyTimeoutTimer();
  flushQueuedCallsToLocal();

  const pendingRemoteCallsSnapshot = Array.from(pendingRemoteCalls.values());
  pendingRemoteCalls.clear();
  pendingRemoteCallsSnapshot.forEach(
    ({ localFallback, resolve, reject, timer }) => {
      clearTimeout(timer);
      void localFallback().then(resolve).catch(reject);
    },
  );
  return true;
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
  if (
    transportState === 'fallback-local' ||
    transportState === 'remote-broken'
  ) {
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
    if (transportState === 'ready' || transportState === 'remote-broken') {
      switchToRemoteBroken(reason);
    } else {
      switchToFallbackLocal(reason);
    }
    return;
  }

  if (transportState === 'fallback-local' || transportState === 'ready') {
    return;
  }

  // Allow recovery from remote-broken: if the background runtime
  // signals ready again (e.g. after a transient failure), transition
  // back to ready state (#35).
  remoteBrokenReason = undefined;
  transportState = 'ready';
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
  ) as Error & { name?: string; stack?: string };
  if (errorInfo?.name) {
    error.name = errorInfo.name;
  }
  if (errorInfo?.stack) {
    error.stack = errorInfo.stack;
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

  appEventBus.emitToSelf({
    type: payload.eventName as any,
    payload: payload.payload,
    isRemote: true,
    cloned: false,
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
      }
    });
  }

  if (transportState === 'idle') {
    transportState = 'starting';
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
      switchToFallbackLocal('SharedRPC unavailable in main runtime');
    }
    return;
  }

  if (transportState === 'idle') {
    transportState = 'starting';
    ensureReadyTimeout();
  }

  observerRetryTimer = setTimeout(() => {
    observerRetryTimer = undefined;
    observerRetryCount += 1;
    ensureBackgroundRuntimeObserver();
  }, OBSERVER_RETRY_MS);
}

function dispatchRemoteRequest(
  request: IBackgroundThreadRequest,
  localFallback: () => Promise<any>,
) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return localFallback();
  }
  if (transportState === 'fallback-local') {
    return localFallback();
  }
  if (transportState === 'remote-broken') {
    throw createTransportError(getRemoteBrokenReason());
  }

  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    if (transportState !== 'ready') {
      return localFallback();
    }
    const reason = 'SharedRPC unavailable after background runtime ready';
    switchToRemoteBroken(reason);
    throw createTransportError(getRemoteBrokenReason(reason));
  }

  const callId = createRemoteCallId();
  const requestKey = buildBackgroundThreadRequestKey(callId);
  transportLog(
    `dispatchRemoteRequest: callId=${callId}, type=${request.type}, method=${'method' in request ? request.method : 'N/A'}`,
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pendingRemoteCalls.has(callId)) {
        return;
      }
      transportLog(`dispatchRemoteRequest TIMEOUT: callId=${callId}`);
      switchToRemoteBroken(
        `Background request timeout. request=${getRequestDebugLabel(request)}`,
      );
    }, REQUEST_TIMEOUT_MS);

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

  if (transportState === 'fallback-local') {
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
    getState: () => transportState,
    isEnabled: isNativeBackgroundThreadTransportEnabled,
  };
}

export function setupMainThreadBackgroundRunner() {
  installGlobalTransport();
  ensureBackgroundRuntimeObserver();
}

setupMainThreadBackgroundRunner();
