import {
  getSharedRPC,
  getSharedStore,
} from '@onekeyfe/react-native-background-thread';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

import {
  BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY,
  BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY,
  BACKGROUND_THREAD_REQUEST_KEY_PREFIX,
  type IBackgroundThreadAppEventRequest,
  type IBackgroundThreadBridgeCallRequest,
  type IBackgroundThreadBridgeChannel,
  type IBackgroundThreadBridgeConnectRequest,
  type IBackgroundThreadBridgeSendPayload,
  type IBackgroundThreadBridgeStatePayload,
  type IBackgroundThreadJotaiStateBroadcastBatchPayload,
  type IBackgroundThreadJotaiStateBroadcastPayload,
  type IBackgroundThreadRequest,
  type IBackgroundThreadServiceCallRequest,
  WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX,
  buildBackgroundThreadAppEventKey,
  buildBackgroundThreadBridgeSendKey,
  buildBackgroundThreadJotaiStateBatchKey,
  buildBackgroundThreadJotaiStateKey,
  buildBackgroundThreadResponseKey,
  buildWebEmbedBridgeRequestKey,
  parseBackgroundThreadCallId,
  parseBackgroundThreadMainCapabilitiesPayload,
  parseBackgroundThreadRequest,
  serializeBackgroundThreadAppEventBroadcastPayload,
  serializeBackgroundThreadBridgeSendPayload,
  serializeBackgroundThreadJotaiStateBroadcastBatchPayload,
  serializeBackgroundThreadJotaiStateBroadcastPayload,
  serializeBackgroundThreadResponse,
} from './rpcProtocol';
import {
  BACKGROUND_THREAD_READY_KEY,
  BACKGROUND_THREAD_READY_WAKE_KEY,
  buildBackgroundThreadFailedPayload,
  serializeBackgroundThreadRuntimePayload,
} from './runtimeReady';

type IBackgroundRuntimeGlobal = typeof globalThis & {
  __setupBackgroundRPCHandler?: () => void;
  __onekeyNativeBackgroundThreadFlushPendingBridgeMessages?: () => void;
  __onekeyNativeBackgroundThreadJotaiBridge?: {
    broadcastStateUpdateFromBgToUi: (
      payload: IBackgroundThreadJotaiStateBroadcastPayload,
    ) => boolean;
    broadcastStateUpdateBatchFromBgToUi: (
      payload: IBackgroundThreadJotaiStateBroadcastBatchPayload,
    ) => boolean;
    // Reported as `true` once the main runtime has written its
    // capability advertisement to SharedRPC. `JotaiBgSync` consults this
    // predicate before emitting on the new `onekey:bg:jotai-batch:` keys
    // — otherwise a partial OTA / split-runtime mismatch (new bg + old
    // main) would silently drop every batched update.
    isMainBatchProtocolReady: () => boolean;
  };
  __onekeyNativeBackgroundThreadBridgeRelay?: {
    emitAppEventToUi: (payload: {
      eventName: string;
      payload: unknown;
      originNodeId?: string;
    }) => boolean;
    sendBridgeMessageToUi: (
      payload: IBackgroundThreadBridgeSendPayload,
    ) => boolean;
    getBridgeState: (
      channel: IBackgroundThreadBridgeChannel,
    ) => IBackgroundThreadBridgeStatePayload | undefined;
  };
};

type IBackgroundThreadRequestExecutor = (
  request:
    | IBackgroundThreadServiceCallRequest
    | IBackgroundThreadBridgeCallRequest,
) => Promise<unknown>;

const HANDLER_RETRY_MS = 50;
const MAX_HANDLER_RETRY_COUNT = 600;
// Periodic heartbeat that re-emits the ready signal so the main thread
// transport can auto-recover if it got stuck in `remote-broken` state
// (e.g. after a slow service call tripped the 30s request timeout while
// the background runtime itself was still healthy).
const HEARTBEAT_INTERVAL_MS = 10_000;

let requestExecutor: IBackgroundThreadRequestExecutor | undefined;
let handlerRetryCount = 0;
let handlerRetryTimer: ReturnType<typeof setTimeout> | undefined;
let handlerInstalled = false;
let readySignalEmitted = false;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
// Tracks the main runtime's current advertised support for the batched
// jotai broadcast wire protocol. Mirrors whatever main last published so
// an OTA rollback (new bg bundle + older main bundle that no longer
// advertises batch support) flips us back to the legacy per-item path
// instead of writing keys the main observer can't decode.
let mainBatchProtocolReady = false;
// Ring buffer size for broadcast sequences (#48).
// If the producer wraps before the consumer reads a slot, the old message is lost.
// 4096 slots gives ~4K messages of headroom before overwrite.
// Sequences run 1..BROADCAST_RING_SIZE — `0` is reserved as an
// "uninitialized" sentinel so consumers can distinguish a fresh slot
// from a legitimate broadcast.
const BROADCAST_RING_SIZE = 4096;
let jotaiStateBroadcastSequence = 0;
let jotaiStateBroadcastBatchSequence = 0;
let appEventBroadcastSequence = 0;
let bridgeSendSequence = 0;

function logBgRpcTrace(message: string, level: 'info' | 'error' = 'info') {
  try {
    NativeLogger.write(
      level === 'error' ? LogLevel.Error : LogLevel.Info,
      `[BgRPC] ${message}`,
    );
  } catch {
    /* noop */
  }
}

const bridgeStateMap: Partial<
  Record<IBackgroundThreadBridgeChannel, IBackgroundThreadBridgeStatePayload>
> = {};
let handleWebEmbedBridgeResponse: (
  key: string,
  value: string | number | boolean,
) => void = () => {};

function buildErrorPayload(error: unknown) {
  const runtimeError = error as Error & {
    autoToast?: unknown;
    className?: unknown;
    code?: unknown;
    key?: unknown;
    requestId?: unknown;
    httpStatusCode?: unknown;
    constructorName?: unknown;
    payload?: unknown;
  };
  const errorPayload: {
    name: string;
    message: string;
    stack?: string;
    autoToast?: boolean;
    className?: string;
    code?: string | number;
    key?: string;
    requestId?: string;
    httpStatusCode?: number;
    constructorName?: string;
    payload?: unknown;
  } = {
    name: runtimeError?.name || 'BackgroundThreadError',
    message: runtimeError?.message || 'Unknown background thread error',
  };
  if (typeof runtimeError?.stack === 'string') {
    errorPayload.stack = runtimeError.stack;
  }
  if (typeof runtimeError?.autoToast === 'boolean') {
    errorPayload.autoToast = runtimeError.autoToast;
  }
  if (typeof runtimeError?.className === 'string') {
    errorPayload.className = runtimeError.className;
  }
  if (
    typeof runtimeError?.code === 'string' ||
    typeof runtimeError?.code === 'number'
  ) {
    errorPayload.code = runtimeError.code;
  }
  if (typeof runtimeError?.key === 'string') {
    errorPayload.key = runtimeError.key;
  }
  if (typeof runtimeError?.requestId === 'string') {
    errorPayload.requestId = runtimeError.requestId;
  }
  if (typeof runtimeError?.httpStatusCode === 'number') {
    errorPayload.httpStatusCode = runtimeError.httpStatusCode;
  }
  if (typeof runtimeError?.constructorName === 'string') {
    errorPayload.constructorName = runtimeError.constructorName;
  }
  if (runtimeError?.payload !== undefined) {
    errorPayload.payload = runtimeError.payload;
  }
  return {
    ok: false,
    error: errorPayload,
  } as const;
}

function emitBackgroundRuntimeSignal(
  payload: string,
  { allowRepeat = false }: { allowRepeat?: boolean } = {},
) {
  if (!allowRepeat && readySignalEmitted) {
    return true;
  }

  const sharedRPC = getSharedRPC();
  const sharedStore = getSharedStore();
  if (!sharedRPC || !sharedStore) {
    return false;
  }

  // Latch readiness in SharedStore (survives any number of main-side reads and
  // persists across restart until the native invalidate path clears it), then
  // fire a content-less wake ping so main re-reads it and flushes its queue.
  sharedStore.set(BACKGROUND_THREAD_READY_KEY, payload);
  sharedRPC.write(BACKGROUND_THREAD_READY_WAKE_KEY, '1');
  if (!allowRepeat) {
    readySignalEmitted = true;
  }
  return true;
}

function emitBackgroundRuntimeReadySignal() {
  if (!requestExecutor) {
    return false;
  }

  return emitBackgroundRuntimeSignal(serializeBackgroundThreadRuntimePayload());
}

function emitBackgroundRuntimeFailedSignal(error: unknown) {
  return emitBackgroundRuntimeSignal(
    serializeBackgroundThreadRuntimePayload(
      buildBackgroundThreadFailedPayload(
        (error as Error)?.message || 'Background runtime init failed',
      ),
    ),
    { allowRepeat: true },
  );
}

function startBackgroundRuntimeHeartbeat() {
  if (heartbeatTimer) {
    return;
  }
  heartbeatTimer = setInterval(() => {
    // Only heartbeat AFTER the initial ready signal has been emitted
    // and the request executor is wired up — this guarantees the
    // heartbeat never races ahead of the genuine ready signal.
    if (!readySignalEmitted || !requestExecutor) {
      return;
    }
    emitBackgroundRuntimeSignal(serializeBackgroundThreadRuntimePayload(), {
      allowRepeat: true,
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function broadcastJotaiStateUpdateFromBgToUi(
  payload: IBackgroundThreadJotaiStateBroadcastPayload,
) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  jotaiStateBroadcastSequence =
    (jotaiStateBroadcastSequence % BROADCAST_RING_SIZE) + 1;
  sharedRPC.write(
    buildBackgroundThreadJotaiStateKey(`${jotaiStateBroadcastSequence}`),
    serializeBackgroundThreadJotaiStateBroadcastPayload(payload),
  );
  return true;
}

/**
 * Batched jotai broadcast: writes a single SharedRPC slot containing N atom
 * updates. Used by `JotaiBgSync` after coalescing same-microtask writes —
 * 2395 setAtomValue → ~150 micro-batch flushes per OK-perp/swap cascade burst.
 *
 * Wire format mirrors the single-broadcast path; the main runtime listens
 * for `BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX` keys and fan-out the
 * batch via `jotaiUpdateFromUiByBgBroadcast` in insertion order.
 */
function broadcastJotaiStateUpdateBatchFromBgToUi(
  payload: IBackgroundThreadJotaiStateBroadcastBatchPayload,
) {
  if (!payload.items || payload.items.length === 0) {
    return true;
  }
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  jotaiStateBroadcastBatchSequence =
    (jotaiStateBroadcastBatchSequence % BROADCAST_RING_SIZE) + 1;
  sharedRPC.write(
    buildBackgroundThreadJotaiStateBatchKey(
      `${jotaiStateBroadcastBatchSequence}`,
    ),
    serializeBackgroundThreadJotaiStateBroadcastBatchPayload(payload),
  );
  return true;
}

function emitAppEventFromBgToUi(payload: {
  eventName: string;
  payload: unknown;
  originNodeId?: string;
}) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  appEventBroadcastSequence =
    (appEventBroadcastSequence % BROADCAST_RING_SIZE) + 1;
  sharedRPC.write(
    buildBackgroundThreadAppEventKey(`${appEventBroadcastSequence}`),
    serializeBackgroundThreadAppEventBroadcastPayload(payload),
  );
  return true;
}

function sendBridgeMessageFromBgToUi(
  payload: IBackgroundThreadBridgeSendPayload,
) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  bridgeSendSequence = (bridgeSendSequence % BROADCAST_RING_SIZE) + 1;
  sharedRPC.write(
    buildBackgroundThreadBridgeSendKey(`${bridgeSendSequence}`),
    serializeBackgroundThreadBridgeSendPayload(payload),
  );
  return true;
}

function handleAppEventRequest(request: IBackgroundThreadAppEventRequest) {
  if (!request.originNodeId) {
    // Symmetric with BackgroundApi.emitEvent: warn loudly so a bridge
    // regression that drops originNodeId surfaces here too. Routing keeps
    // working (the empty-string sentinel never matches a real foreground
    // nodeId, so all foregrounds — including the original sender — fire),
    // and the sender double-fire serves as the visible failure mode.
    defaultLogger.app.eventBus.missingOriginNodeId({
      source: 'native bg-thread handleAppEventRequest',
      eventName: request.eventName,
    });
  }
  // We are the 'background' node receiving an event from the main-thread
  // foreground. Run background listeners AND fan-out to all foregrounds so
  // any sibling foreground (future-proof) also gets it. The original sender
  // identifies its own echo by originNodeId.
  appEventBus.dispatchInboundFromForeground({
    type: request.eventName,
    payload: request.payload,
    originNodeId: request.originNodeId ?? '',
  });
  return true;
}

function handleBridgeConnectRequest(
  request: IBackgroundThreadBridgeConnectRequest,
) {
  bridgeStateMap[request.channel] = {
    channel: request.channel,
    connected: request.connected,
    origin: request.origin,
    globalOnMessageEnabled: request.globalOnMessageEnabled,
  };
  (
    globalThis as IBackgroundRuntimeGlobal
  ).__onekeyNativeBackgroundThreadFlushPendingBridgeMessages?.();
  return true;
}

async function handleRequest(callId: string, value: string | number | boolean) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return;
  }

  const responseKey = buildBackgroundThreadResponseKey(callId);
  const request = parseBackgroundThreadRequest(value);

  if (!request) {
    sharedRPC.write(
      responseKey,
      serializeBackgroundThreadResponse({
        ok: false,
        error: {
          name: 'BackgroundThreadRequestParseError',
          message: `Invalid background request payload. callId=${callId}`,
        },
      }),
    );
    return;
  }

  if (!requestExecutor) {
    if (request.type === 'app-event' || request.type === 'bridge-connect') {
      // handled below without the BackgroundApi executor
    } else {
      sharedRPC.write(
        responseKey,
        serializeBackgroundThreadResponse({
          ok: false,
          error: {
            name: 'BackgroundThreadExecutorUnavailableError',
            message: 'Background request executor is not ready',
          },
        }),
      );
      return;
    }
  }

  let requestLabel: string = request.type;
  if (request.type === 'service-call') {
    requestLabel = `service-call:${request.method}`;
  } else if (request.type === 'bridge-call') {
    requestLabel = `bridge-call:${request.payload.scope || 'unknown-scope'}`;
  }
  const shouldTracePendingInstallTask =
    request.type === 'service-call' &&
    request.method === 'servicePendingInstallTask.processPendingInstallTask';
  const requestStartedAt = Date.now();
  let traceHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
  if (shouldTracePendingInstallTask) {
    logBgRpcTrace(`start callId=${callId}, request=${requestLabel}`);
    traceHeartbeatTimer = setInterval(() => {
      logBgRpcTrace(
        `heartbeat callId=${callId}, request=${requestLabel}, elapsedMs=${
          Date.now() - requestStartedAt
        }`,
      );
    }, 5000);
  }

  try {
    let result: unknown;
    logBgRpcTrace(`exec-start callId=${callId}, request=${requestLabel}`);
    switch (request.type) {
      case 'service-call':
      case 'bridge-call':
        result = await requestExecutor!(request);
        break;
      case 'app-event':
        result = handleAppEventRequest(request);
        break;
      case 'bridge-connect':
        result = handleBridgeConnectRequest(request);
        break;
      default:
        throw new OneKeyLocalError(
          `Background request type is not supported: ${(request as IBackgroundThreadRequest).type}`,
        );
    }
    logBgRpcTrace(
      `exec-done callId=${callId}, request=${requestLabel}, elapsedMs=${
        Date.now() - requestStartedAt
      }`,
    );
    try {
      sharedRPC.write(
        responseKey,
        serializeBackgroundThreadResponse({
          ok: true,
          result,
        }),
      );
      logBgRpcTrace(`write-ok callId=${callId}, request=${requestLabel}`);
    } catch (writeError) {
      logBgRpcTrace(
        `write-fail callId=${callId}, request=${requestLabel}, error=${
          (writeError as Error)?.message || 'unknown'
        }`,
        'error',
      );
    }
    if (shouldTracePendingInstallTask) {
      logBgRpcTrace(
        `done callId=${callId}, request=${requestLabel}, elapsedMs=${
          Date.now() - requestStartedAt
        }`,
      );
    }
  } catch (error) {
    logBgRpcTrace(
      `error callId=${callId}, request=${requestLabel}, elapsedMs=${
        Date.now() - requestStartedAt
      }, message=${(error as Error)?.message || 'unknown'}`,
      'error',
    );
    try {
      sharedRPC.write(
        responseKey,
        serializeBackgroundThreadResponse(buildErrorPayload(error)),
      );
    } catch (writeError) {
      logBgRpcTrace(
        `error-write-fail callId=${callId}, error=${
          (writeError as Error)?.message || 'unknown'
        }`,
        'error',
      );
    }
  } finally {
    if (traceHeartbeatTimer) {
      clearInterval(traceHeartbeatTimer);
    }
  }
}

function applyMainCapabilities() {
  const sharedStore = getSharedStore();
  if (!sharedStore) {
    return;
  }
  try {
    // Capabilities are latched in SharedStore (non-deleting `get`), woken via
    // BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY. Re-reading is idempotent.
    const raw = sharedStore.get(BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY);
    const payload = parseBackgroundThreadMainCapabilitiesPayload(raw);
    // Reflect main's currently advertised capability (bidirectional). Don't
    // latch — an OTA rollback can drop batch support and we must follow it
    // back down to the legacy path on the very next capability read.
    mainBatchProtocolReady = payload?.jotaiStateBatch === true;
  } catch (error) {
    logBgRpcTrace(
      `failed to read main capabilities: ${(error as Error)?.message || String(error)}`,
      'error',
    );
  }
}

function installBackgroundRequestHandler() {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  if (!handlerInstalled) {
    handlerInstalled = true;
    // Value-inline messaging: the native notify callback delivers `(callId,
    // value)` directly, as typed by `ISharedRPC` in the paired native (3.0.45).
    sharedRPC.onWrite((callId, value) => {
      // Handle webembed bridge responses from main thread
      if (callId.startsWith(WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX)) {
        handleWebEmbedBridgeResponse(callId, value);
        return;
      }

      // Main published new capabilities (+ "main is up") to SharedStore and
      // woke us; re-read the latched value.
      if (callId === BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY) {
        applyMainCapabilities();
        return;
      }

      const requestCallId = parseBackgroundThreadCallId(
        callId,
        BACKGROUND_THREAD_REQUEST_KEY_PREFIX,
      );
      if (!requestCallId) {
        return;
      }

      void handleRequest(requestCallId, value);
    });

    // Restart freshness (§4.6): tell native which SharedStore key this (bg)
    // runtime owns, so the native invalidate("background") path clears it on
    // teardown and a restarted main never reads a prior-life bg-ready.
    sharedRPC.registerReadinessKey(BACKGROUND_THREAD_READY_KEY);

    // Catch the case where the main runtime advertised its capabilities
    // before this handler was installed (handler retry path on bg startup,
    // or main thread came up first). The onWrite hook covers future
    // wake pings; this synchronous read covers the already-latched value.
    applyMainCapabilities();
  }

  return true;
}

function scheduleBackgroundHandlerInstall() {
  if (
    handlerRetryTimer ||
    handlerRetryCount >= MAX_HANDLER_RETRY_COUNT ||
    handlerInstalled
  ) {
    return;
  }

  handlerRetryTimer = setTimeout(() => {
    handlerRetryTimer = undefined;
    handlerRetryCount += 1;

    if (!installBackgroundRequestHandler()) {
      scheduleBackgroundHandlerInstall();
      return;
    }

    if (!emitBackgroundRuntimeReadySignal()) {
      scheduleBackgroundHandlerInstall();
    }
  }, HANDLER_RETRY_MS);
}

function ensureBackgroundRequestHandlerInstalled() {
  try {
    if (!installBackgroundRequestHandler()) {
      scheduleBackgroundHandlerInstall();
      return;
    }

    if (!emitBackgroundRuntimeReadySignal()) {
      scheduleBackgroundHandlerInstall();
    }
  } catch (error) {
    if (!emitBackgroundRuntimeFailedSignal(error)) {
      scheduleBackgroundHandlerInstall();
    }
  }
}

export function setBackgroundThreadRequestExecutor(
  executor: IBackgroundThreadRequestExecutor,
) {
  requestExecutor = executor;
  ensureBackgroundRequestHandlerInstalled();
}

// --- WebEmbed bridge reverse RPC (background → main thread) ---

const WEBEMBED_BRIDGE_CALL_TIMEOUT_MS = 30_000;
let webEmbedBridgeCallSequence = 0;
const pendingWebEmbedBridgeCalls = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

handleWebEmbedBridgeResponse = (
  key: string,
  value: string | number | boolean,
) => {
  const callId = key.slice(WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX.length);
  const pending = pendingWebEmbedBridgeCalls.get(callId);
  if (!pending) {
    return;
  }
  pendingWebEmbedBridgeCalls.delete(callId);
  clearTimeout(pending.timer);

  try {
    const response = typeof value === 'string' ? JSON.parse(value) : undefined;
    if (response?.ok) {
      pending.resolve(response.result);
    } else {
      pending.reject(
        new OneKeyLocalError(
          response?.error?.message || 'WebEmbed bridge call failed',
        ),
      );
    }
  } catch (error) {
    pending.reject(error);
  }
};

export function callWebEmbedBridgeViaMainThread(
  data: unknown,
): Promise<unknown> {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return Promise.reject(
      new OneKeyLocalError('SharedRPC unavailable for webEmbed bridge call'),
    );
  }

  webEmbedBridgeCallSequence += 1;
  const callId = `${webEmbedBridgeCallSequence}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingWebEmbedBridgeCalls.delete(callId);
      reject(new OneKeyLocalError('WebEmbed bridge call timeout (30s)'));
    }, WEBEMBED_BRIDGE_CALL_TIMEOUT_MS);

    pendingWebEmbedBridgeCalls.set(callId, { resolve, reject, timer });

    sharedRPC.write(
      buildWebEmbedBridgeRequestKey(callId),
      JSON.stringify(data),
    );
  });
}

// --- end WebEmbed bridge reverse RPC ---

export function setupBackgroundThreadRPCHandler() {
  const runtimeGlobal = globalThis as IBackgroundRuntimeGlobal;

  runtimeGlobal.__setupBackgroundRPCHandler = () => {
    ensureBackgroundRequestHandlerInstalled();
  };
  runtimeGlobal.__onekeyNativeBackgroundThreadJotaiBridge = {
    broadcastStateUpdateFromBgToUi: broadcastJotaiStateUpdateFromBgToUi,
    broadcastStateUpdateBatchFromBgToUi:
      broadcastJotaiStateUpdateBatchFromBgToUi,
    isMainBatchProtocolReady: () => mainBatchProtocolReady,
  };
  runtimeGlobal.__onekeyNativeBackgroundThreadBridgeRelay = {
    emitAppEventToUi: emitAppEventFromBgToUi,
    sendBridgeMessageToUi: sendBridgeMessageFromBgToUi,
    getBridgeState: (channel) => bridgeStateMap[channel],
  };
  // Expose reverse RPC for webEmbed bridge calls from background thread
  (globalThis as any).__onekeyCallWebEmbedBridgeViaMainThread =
    callWebEmbedBridgeViaMainThread;

  ensureBackgroundRequestHandlerInstalled();
  startBackgroundRuntimeHeartbeat();
}

setupBackgroundThreadRPCHandler();
