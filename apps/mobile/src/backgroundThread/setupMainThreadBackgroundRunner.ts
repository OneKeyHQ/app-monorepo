import {
  type ISharedRPC,
  getSharedRPC,
} from '@onekeyfe/react-native-background-thread';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  type IBackgroundThreadServiceCallRequest,
  type IBackgroundThreadTransportState,
  BACKGROUND_THREAD_RESPONSE_KEY_PREFIX,
  parseBackgroundThreadCallId,
  parseBackgroundThreadResponse,
  buildBackgroundThreadRequestKey,
  serializeBackgroundThreadRequest,
} from './rpcProtocol';
import {
  BACKGROUND_THREAD_READY_KEY,
  parseBackgroundThreadRuntimePayload,
} from './runtimeReady';
import { setBackgroundThreadReadyPayload } from './runtimeState';

const OBSERVER_RETRY_MS = 50;
const MAX_OBSERVER_RETRY_COUNT = 600;
const READY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REMOTE_CALL_SLOT_COUNT = 512;

type IQueuedCall = {
  request: IBackgroundThreadServiceCallRequest;
  localFallback: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
};

type IPendingRemoteCall = {
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

type INativeBackgroundThreadTransport = {
  callServiceRequest: (
    request: IBackgroundThreadServiceCallRequest,
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

const queuedCalls: IQueuedCall[] = [];
const pendingRemoteCalls = new Map<string, IPendingRemoteCall>();

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

function flushQueuedCallsToLocal() {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  queuedCallsSnapshot.forEach(({ localFallback, resolve, reject }) => {
    void localFallback().then(resolve).catch(reject);
  });
}

function dispatchQueuedCallsToRemote() {
  const queuedCallsSnapshot = queuedCalls.splice(0);
  queuedCallsSnapshot.forEach(({ request, localFallback, resolve, reject }) => {
    void dispatchRemoteRequest(request, localFallback).then(resolve).catch(reject);
  });
}

function switchToFallbackLocal(reason: string) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return;
  }
  if (transportState === 'ready' || transportState === 'fallback-local') {
    return;
  }

  transportState = 'fallback-local';
  clearReadyTimeoutTimer();
  flushQueuedCallsToLocal();

  const error = createTransportError(reason);
  pendingRemoteCalls.forEach(({ reject, timer }) => {
    clearTimeout(timer);
    reject(error);
  });
  pendingRemoteCalls.clear();
}

function handleRuntimeSignal(sharedRPC: ISharedRPC) {
  const runtimePayload = parseBackgroundThreadRuntimePayload(
    sharedRPC.read(BACKGROUND_THREAD_READY_KEY),
  );

  if (!runtimePayload) {
    return;
  }

  if (runtimePayload.status === 'failed') {
    transportState = 'failed';
    switchToFallbackLocal(
      runtimePayload.errorMessage || 'Background runtime init failed',
    );
    return;
  }

  if (transportState === 'fallback-local' || transportState === 'ready') {
    return;
  }

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

  const pendingCall = cleanupPendingRemoteCall(callId);
  if (!pendingCall) {
    return;
  }

  const response = parseBackgroundThreadResponse(sharedRPC.read(key));
  if (!response) {
    pendingCall.reject(
      createTransportError(`Invalid background response payload. callId=${callId}`),
    );
    return;
  }

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
  request: IBackgroundThreadServiceCallRequest,
  localFallback: () => Promise<any>,
) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return localFallback();
  }
  if (transportState === 'fallback-local' || transportState === 'failed') {
    return localFallback();
  }

  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    if (transportState !== 'ready') {
      return localFallback();
    }
    throw createTransportError('SharedRPC unavailable after background runtime ready');
  }

  const callId = createRemoteCallId();
  const requestKey = buildBackgroundThreadRequestKey(callId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRemoteCalls.delete(callId);
      reject(
        createTransportError(
          `Background request timeout. method=${request.method}`,
        ),
      );
    }, REQUEST_TIMEOUT_MS);

    pendingRemoteCalls.set(callId, {
      resolve,
      reject,
      timer,
    });

    sharedRPC.write(requestKey, serializeBackgroundThreadRequest(request));
  });
}

function callServiceRequest(
  request: IBackgroundThreadServiceCallRequest,
  localFallback: () => Promise<any>,
) {
  if (!isNativeBackgroundThreadTransportEnabled()) {
    return localFallback();
  }

  if (transportState === 'fallback-local' || transportState === 'failed') {
    return localFallback();
  }

  if (transportState === 'ready') {
    return dispatchRemoteRequest(request, localFallback);
  }

  ensureBackgroundRuntimeObserver();

  return new Promise((resolve, reject) => {
    queuedCalls.push({
      request,
      localFallback,
      resolve,
      reject,
    });
  });
}

function installGlobalTransport() {
  getTransportGlobal().__onekeyNativeBackgroundThreadTransport = {
    callServiceRequest,
    getState: () => transportState,
    isEnabled: isNativeBackgroundThreadTransportEnabled,
  };
}

export function setupMainThreadBackgroundRunner() {
  installGlobalTransport();
  ensureBackgroundRuntimeObserver();
}

setupMainThreadBackgroundRunner();
