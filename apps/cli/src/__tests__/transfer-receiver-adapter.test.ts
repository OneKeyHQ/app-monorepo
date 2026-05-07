import * as secp256k1 from '@noble/secp256k1';

import { encryptAsync } from '@onekeyhq/core/src/secret';
import { createE2EEClientToClientApiProxy } from '@onekeyhq/kit-bg/src/services/ServicePrimeTransfer/e2ee/e2eeClientToClientApiProxy';
import { TRANSFER_PAIRING_CODE_LENGTH } from '@onekeyhq/shared/src/consts/primeConsts';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  EPrimeTransferDataType,
  EPrimeTransferServerType,
  type IE2EESocketUserInfo,
  type IPrimeTransferData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import {
  buildTransferPairingUriWithServer,
  parseTransferRoomIdFromPairingCode,
} from '../core/prime-transfer/pairing-code';
import { getTransferPairingRuntimeError } from '../core/prime-transfer/pairing-session-runtime';
import {
  TRANSFER_SOCKET_TRANSPORTS,
  TransferReceiverAdapter,
} from '../core/prime-transfer/transfer-receiver-adapter';
import { AppError, ERROR_CODES } from '../errors';

import type {
  ITransferJoinRoomAfterCreateParams,
  ITransferPairingRuntime,
  ITransferServerApi,
  ITransferSocketLike,
} from '../core/prime-transfer/transfer-types';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: {
      secretPerf: {
        decodePassword: jest.fn(),
        decodePasswordDone: jest.fn(),
        decryptHdCredential: jest.fn(),
        decryptHdCredentialDone: jest.fn(),
        decryptAES: jest.fn(),
        decryptAESDone: jest.fn(),
        keyFromPasswordAndSalt: jest.fn(),
        keyFromPasswordAndSaltDone: jest.fn(),
        revealEntropyToMnemonic: jest.fn(),
        revealEntropyToMnemonicDone: jest.fn(),
      },
    },
  },
}));

function createMockUser(id: string): IE2EESocketUserInfo {
  return {
    id,
    socketId: `${id}-socket`,
    joinedAt: new Date('2026-04-06T07:00:00.000Z'),
    appPlatform: 'cli',
    appPlatformName: 'OneKey CLI',
    appVersion: 'vtest',
    appBuildNumber: '',
    appDeviceName: `device-${id}`,
  };
}

let socketIdCounter = 0;

function createMockSocket(): ITransferSocketLike & {
  disconnectMock: jest.Mock;
  id: string;
  trigger(event: string, payload?: unknown): void;
} {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const id = `socket-${socketIdCounter + 1}`;
  socketIdCounter += 1;

  const socketRef: {
    current?: ITransferSocketLike & {
      disconnectMock: jest.Mock;
      id: string;
      trigger(event: string, payload?: unknown): void;
    };
  } = {};
  const disconnectMock = jest.fn(
    () =>
      socketRef.current as ITransferSocketLike & {
        disconnectMock: jest.Mock;
        id: string;
        trigger(event: string, payload?: unknown): void;
      },
  );

  const socket: ITransferSocketLike & {
    disconnectMock: jest.Mock;
    id: string;
    trigger(event: string, payload?: unknown): void;
  } = {
    disconnectMock,
    id,
    connected: true,
    emit: jest.fn((event: string, ...args: unknown[]) => {
      queueMicrotask(() => {
        const payloadArgs = args.map((arg) => {
          if (typeof arg === 'object' && arg !== null && 'payload' in arg) {
            return (arg as { payload: unknown }).payload;
          }
          return arg;
        });
        for (const listener of listeners.get(event) ?? []) {
          listener(...payloadArgs);
        }
      });
      return true;
    }),
    on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      const currentListeners = listeners.get(event) ?? new Set();
      currentListeners.add(listener);
      listeners.set(event, currentListeners);
      return socket;
    }),
    off: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(listener);
      return socket;
    }),
    listeners(event: string) {
      return [...(listeners.get(event) ?? new Set())];
    },
    disconnect: disconnectMock,
    trigger(event: string, payload?: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  };
  socketRef.current = socket;

  return socket;
}

function createMockServerApi(): {
  serverApi: ITransferServerApi;
  createRoom: jest.Mock<Promise<{ roomId: string }>, []>;
  joinRoomAfterCreate: jest.Mock<
    Promise<{ roomId: string; userId: string }>,
    [ITransferJoinRoomAfterCreateParams]
  >;
  leaveRoom: jest.Mock<
    Promise<{ roomId: string }>,
    [{ roomId: string; userId: string }]
  >;
  getRoomUsers: jest.Mock<Promise<IE2EESocketUserInfo[]>, [{ roomId: string }]>;
} {
  const createRoom = jest.fn(async () => ({ roomId: 'ABCDE-FGHIJ' }));
  const joinRoomAfterCreate = jest.fn(
    async (_params: ITransferJoinRoomAfterCreateParams) => ({
      roomId: 'ABCDE-FGHIJ',
      userId: 'user-1',
    }),
  );
  const leaveRoom = jest.fn(
    async ({ roomId }: { roomId: string; userId: string }) => ({
      roomId,
    }),
  );
  const getRoomUsers = jest.fn<
    Promise<IE2EESocketUserInfo[]>,
    [{ roomId: string }]
  >(async (_params: { roomId: string }) => [createMockUser('user-1')]);

  return {
    serverApi: {
      roomManager: {
        createRoom,
        joinRoomAfterCreate,
        leaveRoom,
        getRoomUsers,
      },
    },
    createRoom,
    joinRoomAfterCreate,
    leaveRoom,
    getRoomUsers,
  };
}

function buildConnectedEncryptedKey(
  pairingCode: string,
  sharedSecret: string,
  users: IE2EESocketUserInfo[],
): string {
  return `${pairingCode.toUpperCase()}--${sharedSecret}--${stringUtils.stableStringify(users)}`;
}

async function generateLocalECDHEKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, true);

  return {
    privateKey: bufferUtils.bytesToHex(privateKey),
    publicKey: bufferUtils.bytesToHex(publicKey),
  };
}

async function deriveLocalSharedSecret({
  privateKey,
  publicKey,
}: {
  privateKey: string;
  publicKey: string;
}): Promise<string> {
  return bufferUtils.bytesToHex(
    secp256k1.getSharedSecret(
      bufferUtils.hexToBytes(privateKey),
      bufferUtils.hexToBytes(publicKey),
      true,
    ),
  );
}

describe('TransferReceiverAdapter', () => {
  it('uses websocket-only transport to avoid Node url.parse deprecation warnings', () => {
    expect(TRANSFER_SOCKET_TRANSPORTS).toEqual(['websocket']);
  });

  it('creates normalized pairing session data in under one second', async () => {
    const socket = createMockSocket();
    const connectSocket = jest.fn(async () => socket);
    const { serverApi, createRoom, joinRoomAfterCreate } =
      createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket,
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
      getDeviceInfo: () => ({
        appPlatformName: 'OneKey CLI',
        appVersion: 'vtest',
        appBuildNumber: '',
        appPlatform: 'cli',
        appDeviceName: 'onekey-cli-test',
      }),
    });

    const startedAt = Date.now();
    const result = await adapter.createPairingSession({
      endpointEnv: 'test',
    });
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(1000);
    expect(connectSocket).toHaveBeenCalledWith(
      'https://transfer.onekeytest.com',
    );
    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(joinRoomAfterCreate).toHaveBeenCalledWith({
      roomId: 'ABCDE-FGHIJ',
      appPlatformName: 'OneKey CLI',
      appVersion: 'vtest',
      appBuildNumber: '',
      appPlatform: 'cli',
      appDeviceName: 'onekey-cli-test',
    });
    expect(result).toMatchObject({
      status: 'pairing',
      loginMethod: 'app_transfer',
      createdAt: '2026-04-06T07:00:00.000Z',
      timeoutMs: 120_000,
      expiresAt: '2026-04-06T07:02:00.000Z',
      pairingPayload: {
        roomId: 'ABCDE-FGHIJ',
        transferType: EPrimeTransferDataType.keylessWallet,
        serverType: EPrimeTransferServerType.OFFICIAL,
        websocketEndpoint: 'wss://transfer.onekeytest.com',
        uri: expect.stringContaining('code='),
        verifyString: 'OneKeyPrimeTransfer',
      },
    });
    expect(result.pairingCode).toHaveLength(TRANSFER_PAIRING_CODE_LENGTH);
    expect(parseTransferRoomIdFromPairingCode(result.pairingCode)).toBe(
      result.pairingPayload.roomId,
    );
    expect(result.pairingPayload.uri).toContain(
      encodeURIComponent(result.pairingCode),
    );
    expect(replaceActiveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'ABCDE-FGHIJ',
        userId: 'user-1',
        pairingCode: result.pairingCode,
        dispose: expect.any(Function),
        getState: expect.any(Function),
        subscribe: expect.any(Function),
        transition: expect.any(Function),
        waitForState: expect.any(Function),
      }),
    );
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];
    expect(runtime?.getState()).toMatchObject({
      event: 'pairing_started',
      status: 'pairing',
      isTerminal: false,
    });

    await runtime?.dispose();
  });

  it('keeps custom server payload metadata aligned with the session endpoint', async () => {
    const socket = createMockSocket();
    const { serverApi } = createMockServerApi();
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession: jest.fn(async () => undefined),
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    const result = await adapter.createPairingSession({
      serverType: EPrimeTransferServerType.CUSTOM,
      customServerUrl: 'https://transfer.example.com/',
    });

    expect(result.pairingPayload.serverType).toBe(
      EPrimeTransferServerType.CUSTOM,
    );
    expect(result.pairingPayload.websocketEndpoint).toBe(
      'wss://transfer.example.com',
    );
    expect(result.pairingPayload.uri).toBe(
      buildTransferPairingUriWithServer(
        result.pairingCode,
        'https://transfer.example.com',
      ),
    );
  });

  it('returns the configured timeout window in the pairing session payload', async () => {
    const socket = createMockSocket();
    const { serverApi } = createMockServerApi();
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession: jest.fn(async () => undefined),
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    const result = await adapter.createPairingSession({
      timeoutMs: 45_000,
    });

    expect(result.timeoutMs).toBe(45_000);
    expect(result.expiresAt).toBe('2026-04-06T07:00:45.000Z');
  });

  it('updates the runtime when a peer joins and the transfer starts', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers, leaveRoom } = createMockServerApi();
    let intervalCallback: (() => void) | undefined;
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const setIntervalFn = ((callback: TimerHandler) => {
      intervalCallback = callback as () => void;
      return 1 as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers
      .mockResolvedValueOnce([createMockUser('user-1')])
      .mockResolvedValueOnce([
        createMockUser('user-1'),
        createMockUser('user-2'),
      ]);

    const result = await adapter.createPairingSession();
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    await Promise.resolve();
    await Promise.resolve();
    expect(runtime?.getState().status).toBe('pairing');

    intervalCallback?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime?.getState().status).toBe('paired');

    socket.trigger('start-transfer', {
      roomId: result.pairingPayload.roomId,
    });

    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_receiving',
      status: 'receiving',
      isTerminal: false,
    });

    await runtime?.dispose();
    expect(leaveRoom).toHaveBeenCalledWith({
      roomId: result.pairingPayload.roomId,
      userId: 'user-1',
    });
  });

  it('stores the verification code from start-transfer before payload delivery begins', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers, joinRoomAfterCreate } =
      createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    joinRoomAfterCreate.mockResolvedValueOnce({
      roomId: 'ABCDE-FGHIJ',
      userId: 'cli-user--338713',
    });
    getRoomUsers.mockResolvedValueOnce([createMockUser('cli-user--338713')]);

    const result = await adapter.createPairingSession();
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    socket.trigger('start-transfer', {
      roomId: result.pairingPayload.roomId,
      randomNumber: '576123',
    });

    expect(runtime?.getState()).toMatchObject({
      event: 'pairing_verified',
      status: 'paired',
      isTerminal: false,
    });
    expect(runtime?.getVerificationCode()).toBe('804836');
  });

  it('treats a peer leaving during pairing as a cancelled transfer', async () => {
    const socket = createMockSocket();
    const { serverApi } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    const result = await adapter.createPairingSession();
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    socket.trigger('user-left', {
      roomId: result.pairingPayload.roomId,
      userId: 'user-2',
      userCount: 1,
    });

    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_cancelled',
      status: 'cancelled',
      isTerminal: true,
    });
  });

  it('rejects custom server URLs that include credentials or query data', async () => {
    const adapter = new TransferReceiverAdapter();

    await expect(
      adapter.createPairingSession({
        serverType: EPrimeTransferServerType.CUSTOM,
        customServerUrl:
          'https://user:pass@transfer.example.com/path?token=secret#frag',
      }),
    ).rejects.toMatchObject({
      code: 'PARAM_INVALID_CONFIG',
      message:
        'Custom Transfer server URL must not include credentials, query parameters, or fragments',
    });
  });

  it('handles verifyPairingCode and sendTransferData through the client-to-client bridge', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const onTransferData = jest.fn<Promise<void>, [IPrimeTransferData]>(
      async () => undefined,
    );
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers
      .mockResolvedValueOnce([createMockUser('user-1')])
      .mockResolvedValueOnce([
        createMockUser('user-1'),
        {
          ...createMockUser('user-2'),
          appPlatform: 'ios',
          appPlatformName: 'OneKey App',
        },
      ]);

    const pairingSession = await adapter.createPairingSession(
      {},
      { onTransferData },
    );
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    const verifyResult = await proxy.api.verifyPairingCode({
      userId: 'user-2',
      encryptedData: encryptedVerifyString.toString('hex'),
      clientPublicKey: clientKeyPair.publicKey,
    });

    expect(verifyResult).toMatchObject({
      success: true,
      serverPublicKey: expect.any(String),
    });
    expect(runtime?.getState().status).toBe('paired');

    const sharedSecret = await deriveLocalSharedSecret({
      privateKey: clientKeyPair.privateKey,
      publicKey: verifyResult.serverPublicKey ?? '',
    });
    clientKeyPair.privateKey = '';

    const encryptedKey = buildConnectedEncryptedKey(
      pairingSession.pairingCode,
      sharedSecret,
      [
        createMockUser('user-1'),
        {
          ...createMockUser('user-2'),
          appPlatform: 'ios',
          appPlatformName: 'OneKey App',
        },
      ],
    );
    const transferData = {
      privateData: {
        credentials: {},
        decryptedCredentials: {},
        importedAccounts: {},
        watchingAccounts: {},
        wallets: {
          'hd-bot--parent-1--0': {
            id: 'hd-bot--parent-1--0',
          },
        },
      },
      publicData: undefined,
      isEmptyData: false,
      isWatchingOnly: false,
      appVersion: '1.0.0',
    } as unknown as IPrimeTransferData;
    const encryptedPayload = await encryptAsync({
      data: Buffer.from(JSON.stringify(transferData), 'utf-8'),
      password: encryptedKey,
      allowRawPassword: true,
    });

    await proxy.api.sendTransferData({
      rawData: encryptedPayload.toString('base64'),
    });

    expect(onTransferData).toHaveBeenCalledWith(
      expect.objectContaining({
        appVersion: '1.0.0',
      }),
      expect.objectContaining({
        assertSessionIsActive: expect.any(Function),
      }),
    );
    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_completed',
      status: 'completed',
      isTerminal: true,
    });
  });

  it('fails the local runtime when pairing verification loses transfer connectivity', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers
      .mockResolvedValueOnce([createMockUser('user-1')])
      .mockRejectedValue(new Error('transport timeout'));

    const pairingSession = await adapter.createPairingSession();
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    await expect(
      proxy.api.verifyPairingCode({
        userId: 'user-2',
        encryptedData: encryptedVerifyString.toString('hex'),
        clientPublicKey: clientKeyPair.publicKey,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.NET_TRANSFER_TIMEOUT.code,
      message: 'Failed to verify the App Transfer pairing session.',
    });

    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_failed',
      status: 'failed',
      isTerminal: true,
    });
  });

  it('clears the temporary connected key after payload handling fails', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let nowMs = 0;
    nowSpy.mockImplementation(() => {
      nowMs += 4000;
      return nowMs;
    });

    const socket = createMockSocket();
    const { serverApi, getRoomUsers, leaveRoom } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const onTransferData = jest.fn<Promise<void>, [IPrimeTransferData]>(
      async () => {
        throw new AppError(
          ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
          'import failed',
          'retry',
        );
      },
    );
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers
      .mockResolvedValueOnce([createMockUser('user-1')])
      .mockResolvedValueOnce([
        createMockUser('user-1'),
        {
          ...createMockUser('user-2'),
          appPlatform: 'ios',
          appPlatformName: 'OneKey App',
        },
      ]);

    const pairingSession = await adapter.createPairingSession(
      {},
      { onTransferData },
    );
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    const verifyResult = await proxy.api.verifyPairingCode({
      userId: 'user-2',
      encryptedData: encryptedVerifyString.toString('hex'),
      clientPublicKey: clientKeyPair.publicKey,
    });

    const sharedSecret = await deriveLocalSharedSecret({
      privateKey: clientKeyPair.privateKey,
      publicKey: verifyResult.serverPublicKey ?? '',
    });
    clientKeyPair.privateKey = '';

    const encryptedKey = buildConnectedEncryptedKey(
      pairingSession.pairingCode,
      sharedSecret,
      [
        createMockUser('user-1'),
        {
          ...createMockUser('user-2'),
          appPlatform: 'ios',
          appPlatformName: 'OneKey App',
        },
      ],
    );
    const encryptedPayload = await encryptAsync({
      data: Buffer.from(
        JSON.stringify({
          privateData: {
            credentials: {},
            decryptedCredentials: {},
            importedAccounts: {},
            watchingAccounts: {},
            wallets: {
              'hd-bot--parent-1--0': {
                id: 'hd-bot--parent-1--0',
              },
            },
          },
          publicData: undefined,
          isEmptyData: false,
          isWatchingOnly: false,
          appVersion: '1.0.0',
        } as unknown as IPrimeTransferData),
        'utf-8',
      ),
      password: encryptedKey,
      allowRawPassword: true,
    });

    await expect(
      proxy.api.sendTransferData({
        rawData: encryptedPayload.toString('base64'),
      }),
    ).rejects.toMatchObject({
      message: 'import failed',
    });

    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_failed',
      status: 'failed',
      isTerminal: true,
    });

    await expect(
      proxy.api.sendTransferData({
        rawData: encryptedPayload.toString('base64'),
      }),
    ).rejects.toMatchObject({
      message: 'import failed',
    });

    await runtime?.dispose();
    expect(leaveRoom).toHaveBeenCalledWith({
      roomId: pairingSession.pairingPayload.roomId,
      userId: 'user-1',
    });
    expect(socket.disconnectMock).toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('rolls back handled payload data if the runtime times out before completion can be committed', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    let runtime: ITransferPairingRuntime | null = null;
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async (nextRuntime) => {
      runtime = nextRuntime;
    });
    const rollback = jest.fn(async () => undefined);
    const onTransferData = jest.fn(async () => {
      runtime?.transition('transfer_timeout');
      return { rollback };
    });
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers.mockResolvedValue([
      createMockUser('user-1'),
      {
        ...createMockUser('user-2'),
        appPlatform: 'ios',
        appPlatformName: 'OneKey App',
      },
    ]);

    const pairingSession = await adapter.createPairingSession(
      {},
      { onTransferData },
    );

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    const verifyResult = await proxy.api.verifyPairingCode({
      userId: 'user-2',
      encryptedData: encryptedVerifyString.toString('hex'),
      clientPublicKey: clientKeyPair.publicKey,
    });

    const sharedSecret = await deriveLocalSharedSecret({
      privateKey: clientKeyPair.privateKey,
      publicKey: verifyResult.serverPublicKey ?? '',
    });
    const encryptedKey = buildConnectedEncryptedKey(
      pairingSession.pairingCode,
      sharedSecret,
      await getRoomUsers({ roomId: pairingSession.pairingPayload.roomId }),
    );
    const encryptedPayload = await encryptAsync({
      data: Buffer.from(
        JSON.stringify({
          privateData: {
            credentials: {},
            decryptedCredentials: {},
            importedAccounts: {},
            watchingAccounts: {},
            wallets: {
              'hd-bot--parent-1--0': {
                id: 'hd-bot--parent-1--0',
              },
            },
          },
          publicData: undefined,
          isEmptyData: false,
          isWatchingOnly: false,
          appVersion: '1.0.0',
        } as unknown as IPrimeTransferData),
        'utf-8',
      ),
      password: encryptedKey,
      allowRawPassword: true,
    });

    await expect(
      proxy.api.sendTransferData({
        rawData: encryptedPayload.toString('base64'),
      }),
    ).rejects.toMatchObject({
      message: 'App Transfer session is no longer active',
    });

    expect(rollback).toHaveBeenCalledTimes(1);
    const timedOutRuntime = replaceActiveSession.mock.calls
      .map(([nextRuntime]) => nextRuntime)
      .filter(
        (nextRuntime): nextRuntime is ITransferPairingRuntime =>
          nextRuntime !== null,
      )
      .at(-1);
    expect(timedOutRuntime).toBeDefined();
    if (!timedOutRuntime) {
      return;
    }
    expect(timedOutRuntime.getState()).toMatchObject({
      event: 'transfer_timeout',
      status: 'timeout',
      isTerminal: true,
    });
  });

  it('rejects late client-to-client requests after the session is cancelled', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers.mockResolvedValue([
      createMockUser('user-1'),
      {
        ...createMockUser('user-2'),
        appPlatform: 'ios',
        appPlatformName: 'OneKey App',
      },
    ]);

    const pairingSession = await adapter.createPairingSession();
    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });

    await proxy.api.cancelTransfer();

    await expect(
      proxy.api.verifyPairingCode({
        userId: 'user-2',
        encryptedData: '00',
        clientPublicKey: '02'.padEnd(66, '0'),
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_TRANSFER_CANCELLED.code,
      message: 'Transfer cancelled.',
    });
  });

  it('supports remote transfer direction updates from the app peer', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers.mockResolvedValue([
      createMockUser('user-1'),
      {
        ...createMockUser('user-2'),
        appPlatform: 'ios',
        appPlatformName: 'OneKey App',
      },
    ]);

    const pairingSession = await adapter.createPairingSession();
    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });

    await expect(
      proxy.api.changeTransferDirection({
        roomId: pairingSession.pairingPayload.roomId,
        fromUserId: 'user-2',
        toUserId: 'user-1',
      }),
    ).resolves.toEqual({
      fromUserId: 'user-2',
      toUserId: 'user-1',
    });
  });

  it('rejects malformed transfer payloads without skipping cleanup', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let nowMs = 0;
    nowSpy.mockImplementation(() => {
      nowMs += 4000;
      return nowMs;
    });

    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const onTransferData = jest.fn<Promise<void>, [IPrimeTransferData]>(
      async () => undefined,
    );
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers.mockResolvedValue([
      createMockUser('user-1'),
      {
        ...createMockUser('user-2'),
        appPlatform: 'ios',
        appPlatformName: 'OneKey App',
      },
    ]);

    const pairingSession = await adapter.createPairingSession(
      {},
      { onTransferData },
    );
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    const verifyResult = await proxy.api.verifyPairingCode({
      userId: 'user-2',
      encryptedData: encryptedVerifyString.toString('hex'),
      clientPublicKey: clientKeyPair.publicKey,
    });

    const sharedSecret = await deriveLocalSharedSecret({
      privateKey: clientKeyPair.privateKey,
      publicKey: verifyResult.serverPublicKey ?? '',
    });
    const encryptedKey = buildConnectedEncryptedKey(
      pairingSession.pairingCode,
      sharedSecret,
      await getRoomUsers({ roomId: pairingSession.pairingPayload.roomId }),
    );
    const malformedPayload = await encryptAsync({
      data: Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf-8'),
      password: encryptedKey,
      allowRawPassword: true,
    });

    await expect(
      proxy.api.sendTransferData({
        rawData: malformedPayload.toString('base64'),
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      message: 'Invalid App Transfer payload',
    });

    expect(onTransferData).not.toHaveBeenCalled();
    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_failed',
      status: 'failed',
      isTerminal: true,
    });

    await expect(
      proxy.api.sendTransferData({
        rawData: malformedPayload.toString('base64'),
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.AUTH_TRANSFER_INVALID_PAYLOAD.code,
      message: 'Invalid App Transfer payload',
    });

    nowSpy.mockRestore();
  });

  it('maps payload decryption failures to SEC_DECRYPTION_FAILED and preserves the terminal error', async () => {
    const socket = createMockSocket();
    const { serverApi, getRoomUsers } = createMockServerApi();
    const replaceActiveSession = jest.fn<
      Promise<void>,
      [ITransferPairingRuntime | null]
    >(async () => undefined);
    const onTransferData = jest.fn<Promise<void>, [IPrimeTransferData]>(
      async () => undefined,
    );
    const adapter = new TransferReceiverAdapter({
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      connectSocket: jest.fn(async () => socket),
      createServerApi: jest.fn(() => serverApi),
      replaceActiveSession,
      setIntervalFn: (() =>
        1 as unknown as ReturnType<
          typeof setInterval
        >) as unknown as typeof setInterval,
      clearIntervalFn: (() => undefined) as unknown as typeof clearInterval,
    });

    getRoomUsers.mockResolvedValue([
      createMockUser('user-1'),
      {
        ...createMockUser('user-2'),
        appPlatform: 'ios',
        appPlatformName: 'OneKey App',
      },
    ]);

    const pairingSession = await adapter.createPairingSession(
      {},
      { onTransferData },
    );
    const runtime =
      replaceActiveSession.mock.calls[
        replaceActiveSession.mock.calls.length - 1
      ][0];

    const proxy = createE2EEClientToClientApiProxy({
      socket: socket as never,
      roomId: pairingSession.pairingPayload.roomId,
    });
    const clientKeyPair = await generateLocalECDHEKeyPair();
    const encryptedVerifyString = await encryptAsync({
      data: Buffer.from('OneKeyPrimeTransfer', 'utf-8'),
      password: pairingSession.pairingCode.toUpperCase(),
      allowRawPassword: true,
    });

    await proxy.api.verifyPairingCode({
      userId: 'user-2',
      encryptedData: encryptedVerifyString.toString('hex'),
      clientPublicKey: clientKeyPair.publicKey,
    });

    const invalidCiphertext = Buffer.from(
      'definitely-not-a-valid-transfer-payload',
      'utf-8',
    ).toString('base64');

    await expect(
      proxy.api.sendTransferData({
        rawData: invalidCiphertext,
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.SEC_DECRYPTION_FAILED.code,
      message: 'Failed to decrypt the App Transfer payload.',
    });

    expect(onTransferData).not.toHaveBeenCalled();
    expect(runtime?.getState()).toMatchObject({
      event: 'transfer_failed',
      status: 'failed',
      isTerminal: true,
    });
    expect(getTransferPairingRuntimeError(runtime!)).toMatchObject({
      code: ERROR_CODES.SEC_DECRYPTION_FAILED.code,
      message: 'Failed to decrypt the App Transfer payload.',
    });
  });
});
