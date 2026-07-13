import { io } from 'socket.io-client';

import { createE2EEServerApiProxy } from '@onekeyhq/kit-bg/src/services/ServicePrimeTransfer/e2ee/e2eeServerApiProxy';
import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { TRANSFER_VERIFY_STRING } from '@onekeyhq/shared/src/consts/primeConsts';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { AppError, ERROR_CODES } from '../../errors';

import { createE2EEClientToClientRuntime } from './e2ee-client-to-client-runtime';
import {
  buildTransferPairingCode,
  buildTransferPairingUriWithServer,
  generateTransferConnectionCode,
} from './pairing-code';
import {
  createTransferPairingRuntime,
  replaceActiveTransferPairingRuntime,
  setTransferPairingRuntimeError,
} from './pairing-session-runtime';
import { DEFAULT_TRANSFER_PAIRING_TIMEOUT_MS } from './transfer-types';
import { buildTransferVerificationCode } from './verification-code';

import type {
  ICreateTransferPairingSessionParams,
  ITransferPairingSession,
  ITransferReceiverAdapterOptions,
  ITransferRoomJoinParams,
  ITransferServerApi,
  ITransferSocketLike,
  TransferPayloadHandler,
} from './transfer-types';

const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const ROOM_USERS_POLL_INTERVAL_MS = 1000;
export const TRANSFER_SOCKET_TRANSPORTS = ['websocket'] as const;

function getDefaultCliDeviceInfo(): ITransferRoomJoinParams {
  return {
    appPlatformName: 'OneKey CLI',
    appVersion: process.version,
    appBuildNumber: '',
    appPlatform: 'cli',
    appDeviceName: `onekey-cli-${process.platform}`,
  };
}

function normalizeCustomServerUrl(customServerUrl: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(customServerUrl);
  } catch (error) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'Invalid custom Transfer server URL',
      'Use a full http(s) URL, for example https://transfer.example.com',
      { cause: error },
    );
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'Invalid custom Transfer server URL',
      'Use a full http(s) URL, for example https://transfer.example.com',
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'Custom Transfer server URL must not include credentials, query parameters, or fragments',
      'Use a plain http(s) base URL, for example https://transfer.example.com',
    );
  }

  return parsedUrl.toString().replace(/\/+$/, '');
}

function sanitizeEndpointForLogs(endpoint: string): string {
  try {
    const parsedUrl = new URL(endpoint);
    parsedUrl.username = '';
    parsedUrl.password = '';
    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.toString().replace(/\/+$/, '');
  } catch {
    return endpoint;
  }
}

function toWebSocketEndpoint(endpoint: string): string {
  return endpoint.replace(/^http/, 'ws');
}

function resolveTransferEndpoints({
  endpointEnv,
  serverType,
  customServerUrl,
}: {
  endpointEnv: 'test' | 'prod';
  serverType: EPrimeTransferServerType;
  customServerUrl?: string;
}): {
  socketEndpoint: string;
  websocketEndpoint: string;
  uriServerParam?: string;
} {
  if (serverType === EPrimeTransferServerType.CUSTOM) {
    if (!customServerUrl) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        'Custom Transfer server URL is required',
        'Provide a custom http(s) Transfer server URL before using CUSTOM mode',
      );
    }

    const normalizedServerUrl = normalizeCustomServerUrl(customServerUrl);
    return {
      socketEndpoint: normalizedServerUrl,
      websocketEndpoint: toWebSocketEndpoint(normalizedServerUrl),
      uriServerParam: normalizedServerUrl,
    };
  }

  return {
    socketEndpoint: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Transfer,
      env: endpointEnv,
    }),
    websocketEndpoint: buildServiceEndpoint({
      serviceName: EServiceEndpointEnum.Transfer,
      env: endpointEnv,
      isWebSocket: true,
    }),
  };
}

async function connectTransferSocket(
  endpoint: string,
): Promise<ITransferSocketLike> {
  return new Promise((resolve, reject) => {
    const socket = io(endpoint, {
      transports: [...TRANSFER_SOCKET_TRANSPORTS],
      upgrade: false,
      timeout: SOCKET_CONNECT_TIMEOUT_MS,
    });
    let onConnect: () => void = () => {};
    let onConnectError: (error: unknown) => void = () => {};

    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };

    onConnect = () => {
      cleanup();
      resolve(socket as unknown as ITransferSocketLike);
    };

    onConnectError = (error: unknown) => {
      cleanup();
      socket.disconnect();
      const message = String(
        (error as { message?: string })?.message ?? '',
      ).toLowerCase();
      const code = message.includes('timeout')
        ? ERROR_CODES.NET_TRANSFER_TIMEOUT.code
        : ERROR_CODES.NET_TRANSFER_UNREACHABLE.code;
      const userMessage = message.includes('timeout')
        ? 'Timed out while connecting to the Transfer server.'
        : 'Unable to reach the Transfer server.';
      reject(
        new AppError(
          code,
          userMessage,
          'Check your network connection or retry with a valid Transfer server endpoint',
          {
            cause: error,
            details: {
              endpoint: sanitizeEndpointForLogs(endpoint),
              phase: 'connect',
            },
          },
        ),
      );
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) {
      cleanup();
      resolve(socket as unknown as ITransferSocketLike);
    }
  });
}

function createTransferServerApi(
  socket: ITransferSocketLike,
): ITransferServerApi {
  return createE2EEServerApiProxy({
    socket: socket as never,
  }) as unknown as ITransferServerApi;
}

function createIncompletePairingSessionError(): AppError {
  return new AppError(
    ERROR_CODES.NET_REQUEST_FAILED.code,
    'Transfer server returned an incomplete pairing session',
    'Retry the App Transfer login flow',
    {
      details: {
        phase: 'pairing_setup',
      },
    },
  );
}

function failRuntime(
  runtime: ReturnType<typeof createTransferPairingRuntime>,
  error: AppError,
): void {
  setTransferPairingRuntimeError(runtime, error);
  const currentState = runtime.getState();
  if (!currentState.isTerminal && currentState.event !== 'transfer_failed') {
    runtime.transition('transfer_failed');
  }
}

async function disposePairingRuntime(params: {
  roomId?: string;
  userId?: string;
  serverApi: ITransferServerApi;
  socket: ITransferSocketLike;
}): Promise<void> {
  const { roomId, userId, serverApi, socket } = params;

  try {
    if (roomId && userId) {
      await serverApi.roomManager.leaveRoom({ roomId, userId });
    }
  } catch {
    // Best-effort runtime cleanup.
  } finally {
    socket.disconnect();
  }
}

function transitionRuntimeIfNeeded(
  runtime: ReturnType<typeof createTransferPairingRuntime>,
  event:
    | 'pairing_verified'
    | 'transfer_receiving'
    | 'transfer_cancelled'
    | 'transfer_failed',
): void {
  const currentState = runtime.getState();
  if (currentState.isTerminal || currentState.event === event) {
    return;
  }

  runtime.transition(event);
}

function startPairingRuntimeMonitor({
  roomId,
  userId,
  runtime,
  serverApi,
  socket,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  roomUsersPollIntervalMs = ROOM_USERS_POLL_INTERVAL_MS,
}: {
  roomId: string;
  userId: string;
  runtime: ReturnType<typeof createTransferPairingRuntime>;
  serverApi: ITransferServerApi;
  socket: ITransferSocketLike;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  roomUsersPollIntervalMs?: number;
}): () => void {
  let isStopped = false;
  let isPollingRoomUsers = false;

  const onStartTransfer = (...args: unknown[]) => {
    const [payload = {}] = args as Array<
      { roomId?: string; randomNumber?: string } | undefined
    >;
    if (payload.roomId !== roomId) {
      return;
    }

    if (runtime.getState().status === 'pairing') {
      transitionRuntimeIfNeeded(runtime, 'pairing_verified');
    }

    if (payload.randomNumber) {
      try {
        runtime.setVerificationCode(
          buildTransferVerificationCode({
            userId,
            randomNumber: payload.randomNumber,
          }),
        );
      } catch (error) {
        failRuntime(
          runtime,
          error instanceof AppError
            ? error
            : new AppError(
                ERROR_CODES.NET_REQUEST_FAILED.code,
                'App Transfer verification code is unavailable.',
                'Retry the App Transfer login flow',
                { cause: error },
              ),
        );
      }
      return;
    }

    transitionRuntimeIfNeeded(runtime, 'transfer_receiving');
  };

  const onRoomFull = (...args: unknown[]) => {
    const [payload = {}] = args as Array<{ roomId?: string } | undefined>;
    if (payload.roomId !== roomId) {
      return;
    }

    failRuntime(
      runtime,
      new AppError(
        ERROR_CODES.NET_REQUEST_FAILED.code,
        'Transfer session became unavailable before the wallet payload was received.',
        'Retry the App Transfer login flow',
        {
          details: {
            phase: 'pairing',
          },
        },
      ),
    );
  };

  const onUserLeft = (...args: unknown[]) => {
    const [payload = {}] = args as Array<
      { roomId?: string; userId?: string } | undefined
    >;
    if (payload.roomId !== roomId || payload.userId === userId) {
      return;
    }

    transitionRuntimeIfNeeded(runtime, 'transfer_cancelled');
  };

  const onDisconnect = () => {
    failRuntime(
      runtime,
      new AppError(
        ERROR_CODES.NET_TRANSFER_UNREACHABLE.code,
        'Connection to the Transfer server was lost.',
        'Check your network connection and retry the App Transfer login flow',
        {
          details: {
            phase: 'transfer',
          },
        },
      ),
    );
  };

  const onConnectError = () => {
    failRuntime(
      runtime,
      new AppError(
        ERROR_CODES.NET_TRANSFER_UNREACHABLE.code,
        'Connection to the Transfer server was lost.',
        'Check your network connection and retry the App Transfer login flow',
        {
          details: {
            phase: 'transfer',
          },
        },
      ),
    );
  };

  const pollRoomUsers = async () => {
    if (
      isStopped ||
      isPollingRoomUsers ||
      runtime.getState().isTerminal ||
      runtime.getState().status !== 'pairing'
    ) {
      return;
    }

    isPollingRoomUsers = true;
    try {
      const users = await serverApi.roomManager.getRoomUsers({ roomId });
      if (users.some((user) => user.id !== userId)) {
        transitionRuntimeIfNeeded(runtime, 'pairing_verified');
      }
    } catch {
      // Ignore polling failures until a terminal transport error arrives.
    } finally {
      isPollingRoomUsers = false;
    }
  };

  socket.on('start-transfer', onStartTransfer);
  socket.on('room-full', onRoomFull);
  socket.on('user-left', onUserLeft);
  socket.on('disconnect', onDisconnect);
  socket.on('connect_error', onConnectError);

  const pollInterval = setIntervalFn(() => {
    void pollRoomUsers();
  }, roomUsersPollIntervalMs);

  void pollRoomUsers();

  return () => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    clearIntervalFn(pollInterval);
    socket.off('start-transfer', onStartTransfer);
    socket.off('room-full', onRoomFull);
    socket.off('user-left', onUserLeft);
    socket.off('disconnect', onDisconnect);
    socket.off('connect_error', onConnectError);
  };
}

export class TransferReceiverAdapter {
  private readonly options: ITransferReceiverAdapterOptions;

  constructor(options: ITransferReceiverAdapterOptions = {}) {
    this.options = options;
  }

  async createPairingSession(
    {
      endpointEnv = 'test',
      timeoutMs = DEFAULT_TRANSFER_PAIRING_TIMEOUT_MS,
      transferType = EPrimeTransferDataType.allWallet,
      serverType = EPrimeTransferServerType.OFFICIAL,
      customServerUrl,
    }: ICreateTransferPairingSessionParams = {},
    {
      onTransferData,
    }: {
      onTransferData?: TransferPayloadHandler;
    } = {},
  ): Promise<ITransferPairingSession> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        'Invalid pairing timeout',
        'Use a positive timeout value for the App Transfer pairing session',
      );
    }

    const now = this.options.now?.() ?? new Date();
    const connectSocket = this.options.connectSocket ?? connectTransferSocket;
    const createServerApi =
      this.options.createServerApi ?? createTransferServerApi;
    const replaceActiveSession =
      this.options.replaceActiveSession ?? replaceActiveTransferPairingRuntime;
    const getDeviceInfo = this.options.getDeviceInfo ?? getDefaultCliDeviceInfo;
    const setIntervalFn = this.options.setIntervalFn ?? setInterval;
    const clearIntervalFn = this.options.clearIntervalFn ?? clearInterval;
    const roomUsersPollIntervalMs =
      this.options.roomUsersPollIntervalMs ?? ROOM_USERS_POLL_INTERVAL_MS;
    const { socketEndpoint, websocketEndpoint, uriServerParam } =
      resolveTransferEndpoints({
        endpointEnv,
        serverType,
        customServerUrl,
      });

    await Promise.resolve(replaceActiveSession(null));

    const socket = await connectSocket(socketEndpoint);
    const serverApi = createServerApi(socket);
    let roomId: string | undefined;
    let userId: string | undefined;
    let stopMonitoring: (() => void) | undefined;
    let clientToClientRuntime:
      | ReturnType<typeof createE2EEClientToClientRuntime>
      | undefined;

    try {
      const room = await serverApi.roomManager.createRoom();
      roomId = room.roomId;

      if (!roomId) {
        throw createIncompletePairingSessionError();
      }

      const joinResult = await serverApi.roomManager.joinRoomAfterCreate({
        roomId,
        ...getDeviceInfo(),
      });

      roomId = joinResult.roomId || roomId;
      userId = joinResult.userId;

      if (!roomId || !userId) {
        throw createIncompletePairingSessionError();
      }

      const { codeWithSeparator } = generateTransferConnectionCode();
      const pairingCode = buildTransferPairingCode({
        roomId,
        codeWithSeparator,
      });

      const runtime = createTransferPairingRuntime({
        roomId,
        userId,
        pairingCode,
        dispose: async () => {
          stopMonitoring?.();
          clientToClientRuntime?.dispose();
          await disposePairingRuntime({
            roomId,
            userId,
            serverApi,
            socket,
          });
        },
      });

      stopMonitoring = startPairingRuntimeMonitor({
        roomId,
        userId,
        runtime,
        serverApi,
        socket,
        setIntervalFn,
        clearIntervalFn,
        roomUsersPollIntervalMs,
      });

      clientToClientRuntime = createE2EEClientToClientRuntime({
        socket,
        roomId,
        pairingCode,
        runtime,
        serverApi,
        transferPayloadHandler: onTransferData,
      });

      await Promise.resolve(replaceActiveSession(runtime));

      return {
        status: 'pairing',
        loginMethod: 'app_transfer',
        pairingCode,
        createdAt: now.toISOString(),
        timeoutMs,
        expiresAt: new Date(now.getTime() + timeoutMs).toISOString(),
        pairingPayload: {
          roomId,
          transferType,
          serverType,
          websocketEndpoint,
          uri: buildTransferPairingUriWithServer(pairingCode, uriServerParam),
          verifyString: TRANSFER_VERIFY_STRING,
        },
      };
    } catch (error) {
      stopMonitoring?.();
      clientToClientRuntime?.dispose();
      await disposePairingRuntime({
        roomId,
        userId,
        serverApi,
        socket,
      });
      throw AppError.from(error);
    }
  }
}
