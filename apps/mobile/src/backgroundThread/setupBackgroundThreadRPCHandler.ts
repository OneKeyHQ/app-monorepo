import { getSharedRPC } from '@onekeyfe/react-native-background-thread';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX,
  BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX,
  BACKGROUND_THREAD_REQUEST_KEY_PREFIX,
  type IBackgroundThreadAppEventRequest,
  type IBackgroundThreadBridgeCallRequest,
  type IBackgroundThreadBridgeConnectRequest,
  type IBackgroundThreadBridgeChannel,
  type IBackgroundThreadBridgeSendPayload,
  type IBackgroundThreadBridgeStatePayload,
  type IBackgroundThreadJotaiStateBroadcastPayload,
  type IBackgroundThreadRequest,
  type IBackgroundThreadServiceCallRequest,
  buildBackgroundThreadAppEventKey,
  buildBackgroundThreadBridgeSendKey,
  buildBackgroundThreadJotaiStateKey,
  buildBackgroundThreadResponseKey,
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

  jotaiStateBroadcastSequence = (jotaiStateBroadcastSequence + 1) % 512;
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

  appEventBroadcastSequence = (appEventBroadcastSequence + 1) % 512;
  sharedRPC.write(
    buildBackgroundThreadAppEventKey(`${appEventBroadcastSequence}`),
    serializeBackgroundThreadAppEventBroadcastPayload(payload),
  );
  return true;
}

function sendBridgeMessageFromBgToUi(payload: IBackgroundThreadBridgeSendPayload) {
  const sharedRPC = getSharedRPC();
  if (!sharedRPC) {
    return false;
  }

  bridgeSendSequence = (bridgeSendSequence + 1) % 512;
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
        throw new Error(
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

  ensureBackgroundRequestHandlerInstalled();
}

setupBackgroundThreadRPCHandler();
