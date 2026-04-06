import { getSharedRPC } from '@onekeyfe/react-native-background-thread';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  BACKGROUND_THREAD_REQUEST_KEY_PREFIX,
  WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX,
  type IBackgroundThreadAppEventRequest,
  type IBackgroundThreadBridgeCallRequest,
  type IBackgroundThreadBridgeChannel,
  type IBackgroundThreadBridgeConnectRequest,
  type IBackgroundThreadBridgeSendPayload,
  type IBackgroundThreadBridgeStatePayload,
  type IBackgroundThreadJotaiStateBroadcastPayload,
  type IBackgroundThreadRequest,
  type IBackgroundThreadServiceCallRequest,
  buildBackgroundThreadAppEventKey,
  buildBackgroundThreadBridgeSendKey,
  buildBackgroundThreadJotaiStateKey,
  buildBackgroundThreadResponseKey,
  buildWebEmbedBridgeRequestKey,
  parseBackgroundThreadCallId,
  parseBackgroundThreadRequest,
  serializeBackgroundThreadAppEventBroadcastPayload,
  serializeBackgroundThreadBridgeSendPayload,
  serializeBackgroundThreadJotaiStateBroadcastPayload,
  serializeBackgroundThreadResponse,
} from './rpcProtocol';
import {
  BACKGROUND_THREAD_READY_KEY,
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
  };
  __onekeyNativeBackgroundThreadBridgeRelay?: {
    emitAppEventToUi: (payload: {
      eventName: string;
      payload: unknown;
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

let requestExecutor: IBackgroundThreadRequestExecutor | undefined;
let handlerRetryCount = 0;
let handlerRetryTimer: ReturnType<typeof setTimeout> | undefined;
let handlerInstalled = false;
let readySignalEmitted = false;
// Ring buffer size for broadcast sequences (#48).
// If the producer wraps before the consumer reads a slot, the old message is lost.
// 4096 slots gives ~4K messages of headroom before overwrite.
const BROADCAST_RING_SIZE = 4096;
let jotaiStateBroadcastSequence = 0;
let appEventBroadcastSequence = 0;
let bridgeSendSequence = 0;

const bridgeStateMap: Partial<
  Record<IBackgroundThreadBridgeChannel, IBackgroundThreadBridgeStatePayload>
> = {};

function buildErrorPayload(error: unknown) {
  const runtimeError = error as Error;
  return {
    ok: false,
    error: {
      name: runtimeError?.name || 'BackgroundThreadError',
      message: runtimeError?.message || 'Unknown background thread error',
      stack: runtimeError?.stack,
    },
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
  if (!sharedRPC) {
    return false;
  }

  sharedRPC.write(BACKGROUND_THREAD_READY_KEY, payload);
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

function broadcastJotaiStateUpdateFromBgToUi(
  payload: IBackgroundThreadJotaiStateBroadcastPayload,
) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  jotaiStateBroadcastSequence =
    (jotaiStateBroadcastSequence + 1) % BROADCAST_RING_SIZE;
  sharedRPC.write(
    buildBackgroundThreadJotaiStateKey(`${jotaiStateBroadcastSequence}`),
    serializeBackgroundThreadJotaiStateBroadcastPayload(payload),
  );
  return true;
}

function emitAppEventFromBgToUi(payload: {
  eventName: string;
  payload: unknown;
}) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  appEventBroadcastSequence =
    (appEventBroadcastSequence + 1) % BROADCAST_RING_SIZE;
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

  bridgeSendSequence = (bridgeSendSequence + 1) % BROADCAST_RING_SIZE;
  sharedRPC.write(
    buildBackgroundThreadBridgeSendKey(`${bridgeSendSequence}`),
    serializeBackgroundThreadBridgeSendPayload(payload),
  );
  return true;
}

function handleAppEventRequest(request: IBackgroundThreadAppEventRequest) {
  appEventBus.emitToSelf({
    type: request.eventName as any,
    payload: request.payload,
    isRemote: true,
    cloned: false,
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

async function handleRequest(callId: string) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return;
  }

  const responseKey = buildBackgroundThreadResponseKey(callId);
  const request = parseBackgroundThreadRequest(
    sharedRPC.read(`${BACKGROUND_THREAD_REQUEST_KEY_PREFIX}${callId}`),
  );

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

  try {
    let result: unknown;
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
    sharedRPC.write(
      responseKey,
      serializeBackgroundThreadResponse({
        ok: true,
        result,
      }),
    );
  } catch (error) {
    sharedRPC.write(
      responseKey,
      serializeBackgroundThreadResponse(buildErrorPayload(error)),
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
    sharedRPC.onWrite((callId) => {
      // Handle webembed bridge responses from main thread
      if (callId.startsWith(WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX)) {
        handleWebEmbedBridgeResponse(sharedRPC, callId);
        return;
      }

      const requestCallId = parseBackgroundThreadCallId(
        callId,
        BACKGROUND_THREAD_REQUEST_KEY_PREFIX,
      );
      if (!requestCallId) {
        return;
      }

      void handleRequest(requestCallId);
    });
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

function handleWebEmbedBridgeResponse(
  sharedRPC: ReturnType<typeof getSharedRPC>,
  key: string,
) {
  if (!sharedRPC) {
    return;
  }
  const callId = key.slice(WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX.length);
  const pending = pendingWebEmbedBridgeCalls.get(callId);
  if (!pending) {
    return;
  }
  pendingWebEmbedBridgeCalls.delete(callId);
  clearTimeout(pending.timer);

  try {
    const raw = sharedRPC.read(key);
    const response = typeof raw === 'string' ? JSON.parse(raw) : undefined;
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
}

export function callWebEmbedBridgeViaMainThread(data: unknown): Promise<unknown> {
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
}

setupBackgroundThreadRPCHandler();
