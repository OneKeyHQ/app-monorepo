import { Core } from '@walletconnect/core';
import { HEARTBEAT_EVENTS } from '@walletconnect/heartbeat';
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider';
import WsConnection from '@walletconnect/jsonrpc-ws-connection';
import SignClient from '@walletconnect/sign-client';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { WALLET_CONNECT_RELAY_URLS } from '@onekeyhq/shared/src/walletConnect/constant';

import walletConnectClient from './walletConnectClient';
import {
  dappSideWalletConnectDiagnostics,
  walletConnectDiagnostics,
} from './WalletConnectDiagnostics';
import { WalletConnectRelayController } from './WalletConnectRelayController';

const RELAYS = WALLET_CONNECT_RELAY_URLS;
let coreNumber = 0;

function createCore(initialRelayUrl: string = RELAYS[0]) {
  coreNumber += 1;
  return new Core({
    customStoragePrefix: `relay-fallback-test-${coreNumber}`,
    relayUrl: initialRelayUrl,
    logger: 'silent',
  });
}

function prepareCore(core: InstanceType<typeof Core>, identity = 'test-auth') {
  const { relayer } = core;
  const signJWT = jest
    .spyOn(core.crypto, 'signJWT')
    .mockResolvedValue(identity);
  jest.spyOn(relayer, 'confirmOnlineStateOrThrow').mockResolvedValue();
  jest.spyOn(relayer.subscriber, 'hasAnyTopics', 'get').mockReturnValue(true);
  jest.spyOn(relayer.subscriber, 'start').mockResolvedValue();
  jest.spyOn(relayer.subscriber, 'stop').mockResolvedValue();
  return signJWT;
}

function mockClose(connection: WsConnection) {
  jest.spyOn(connection, 'close').mockImplementation(async () => {
    Object.assign(connection, { socket: undefined, registering: false });
    connection.events.emit('close');
  });
}

describe('WalletConnect application relay controller with the unmodified SDK', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    { enabled: true, failures: 6, dapp: false, initial: 0 },
    { enabled: true, failures: 11, dapp: false, initial: 0 },
    { enabled: true, failures: 16, dapp: false, initial: 1 },
    { enabled: false, failures: 6, dapp: false, initial: 0 },
    { enabled: true, failures: 6, dapp: true, initial: 0 },
  ])(
    'alternates complete rounds after $failures failures; enabled=$enabled, DApp=$dapp',
    async ({ enabled, failures, dapp, initial }) => {
      jest.useFakeTimers();
      let core: InstanceType<typeof Core>;
      if (dapp) {
        jest
          .spyOn(Core.prototype, 'start')
          .mockImplementation(
            async function start(this: InstanceType<typeof Core>) {
              jest
                .spyOn(this.crypto, 'getClientId')
                .mockResolvedValue('test-client-id');
              jest.spyOn(this.storage, 'setItem').mockResolvedValue();
            },
          );
        const initializeClient = jest
          .spyOn(SignClient, 'init')
          .mockImplementation(async (opts) => new SignClient(opts));
        const [client, concurrentClient] = await Promise.all([
          walletConnectClient.getDappSideClient(),
          walletConnectClient.getDappSideClient(),
        ]);
        expect(concurrentClient).toBe(client);
        expect(initializeClient).toHaveBeenCalledTimes(1);
        if (!(client.core instanceof Core)) {
          throw new OneKeyLocalError(
            'Expected the DApp client to use SDK Core',
          );
        }
        core = client.core;
      } else {
        core = createCore(RELAYS[initial]);
        if (enabled) WalletConnectRelayController.attach(core, RELAYS[initial]);
      }
      const signJWT = prepareCore(core);
      const { relayer } = core;
      const attempts: string[] = [];
      const switches: unknown[] = [];
      relayer.on('onekey_relay_changed', (event: unknown) =>
        switches.push(event),
      );
      jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection)) {
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          }
          mockClose(this.connection);
          attempts.push(new URL(this.connection.url).origin);
          if (attempts.length <= failures) {
            throw new OneKeyLocalError(
              'Synthetic WebSocket connection failure',
            );
          }
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      const connecting = relayer.transportOpen().catch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return relayer.transportOpen();
      });
      await jest.advanceTimersByTimeAsync(60_000);
      await connecting;
      if (dapp) {
        expect(dappSideWalletConnectDiagnostics.getSnapshot()).toMatchObject({
          connectionAttempts: failures + 1,
          connectionSuccesses: 1,
          relayUrl: RELAYS[1],
        });
        expect(walletConnectDiagnostics.getSnapshot()).toMatchObject({
          connectionAttempts: 0,
          connectionSuccesses: 0,
        });
      }
      expect(attempts).toEqual(
        Array.from(
          { length: failures + 1 },
          (_, index) =>
            RELAYS[enabled ? (initial + Math.floor(index / 5)) % 2 : initial],
        ),
      );
      expect(signJWT.mock.calls.map(([audience]) => audience)).toEqual(
        attempts,
      );
      expect(switches).toHaveLength(enabled ? Math.floor(failures / 5) : 0);
      expect(relayer.connected).toBe(true);

      const successfulRelay = attempts[attempts.length - 1];
      if (enabled) {
        await relayer.transportOpen(successfulRelay);
        expect(attempts).toHaveLength(failures + 1);
      }
      await relayer.provider.connection.close();
      await relayer.transportOpen();
      expect(attempts[attempts.length - 1]).toBe(successfulRelay);
      expect(switches).toHaveLength(enabled ? Math.floor(failures / 5) : 0);
    },
  );

  it.each([
    { firstPairing: false, initial: 0 },
    { firstPairing: false, initial: 1 },
    { firstPairing: true, initial: 0 },
    { firstPairing: true, initial: 1 },
  ])(
    'exits after ten attempts and permits the SDK heartbeat to reconnect; firstPairing=$firstPairing, initial=$initial',
    async ({ firstPairing, initial }) => {
      jest.useFakeTimers();
      const core = createCore(RELAYS[initial]);
      prepareCore(core);
      const { relayer } = core;
      const hasTopics = jest
        .spyOn(relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      jest.spyOn(relayer.messages, 'init').mockResolvedValue();
      jest.spyOn(relayer.subscriber, 'init').mockResolvedValue();
      WalletConnectRelayController.attach(core, RELAYS[initial]);

      // Register the real SDK reconnect listeners without restoring topics.
      await relayer.init();
      await jest.advanceTimersByTimeAsync(0);
      expect(
        core.heartbeat.events.listenerCount(HEARTBEAT_EVENTS.pulse),
      ).toBeGreaterThan(0);
      const attempts: string[] = [];
      jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection)) {
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          }
          mockClose(this.connection);
          attempts.push(new URL(this.connection.url).origin);
          if (attempts.length <= 10) {
            throw new OneKeyLocalError(
              'Synthetic WebSocket connection failure',
            );
          }
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      jest
        .spyOn(relayer.subscriber, 'subscribe')
        .mockImplementation(async (topic) => {
          hasTopics.mockReturnValue(true);
          await relayer.request({ method: 'irn_subscribe', params: { topic } });
          return 'test-subscription';
        });

      if (!firstPairing) hasTopics.mockReturnValue(true);
      const connecting = (
        firstPairing ? relayer.subscribe('test-topic') : relayer.transportOpen()
      ).catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(40_000);
      expect(await connecting).toBeInstanceOf(Error);
      expect(attempts).toEqual([
        ...Array.from({ length: 5 }, () => RELAYS[initial]),
        ...Array.from({ length: 5 }, () => RELAYS[1 - initial]),
      ]);
      expect(relayer.transportExplicitlyClosed).toBe(false);

      // No application timer starts a third round after the invocation exits.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(attempts).toHaveLength(10);
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await jest.advanceTimersByTimeAsync(1000);
      expect(attempts).toHaveLength(11);
      expect(attempts[10]).toBe(RELAYS[initial]);
      expect(relayer.connected).toBe(true);
      expect(relayer.transportExplicitlyClosed).toBe(false);
    },
  );

  it('joins concurrent retry triggers and waits for a late socket to close before opening another relay', async () => {
    jest.useFakeTimers();
    const core = createCore(RELAYS[1]);
    prepareCore(core);
    WalletConnectRelayController.attach(core, RELAYS[1]);
    const attempts: string[] = [];
    const liveConnections = new Map<WsConnection, string>();
    let maxLiveRelays = 0;
    let finishLateHandshake: () => void = () => {};
    let acknowledgeClose: () => void = () => {};
    let closeStarted = false;
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        const connection = this.connection;
        const relay = new URL(connection.url).origin;
        attempts.push(relay);
        const connected = () => {
          Object.assign(connection, {
            socket: { readyState: 1 },
            registering: false,
          });
          liveConnections.set(connection, relay);
          maxLiveRelays = Math.max(
            maxLiveRelays,
            new Set(liveConnections.values()).size,
          );
          connection.events.emit('open');
          this.events.emit('connect');
        };
        const closed = () => {
          Object.assign(connection, { socket: undefined, registering: false });
          liveConnections.delete(connection);
          connection.events.emit('close');
        };
        if (attempts.length === 1) {
          Object.assign(connection, { registering: true });
          jest.spyOn(connection, 'close').mockImplementation(
            () =>
              new Promise<void>((resolve) => {
                closeStarted = true;
                acknowledgeClose = () => {
                  closed();
                  resolve();
                };
              }),
          );
          return new Promise<void>((resolve) => {
            finishLateHandshake = () => {
              connected();
              resolve();
            };
          });
        }
        jest.spyOn(connection, 'close').mockImplementation(async () => {
          closed();
        });
        if (attempts.length <= 5) {
          throw new OneKeyLocalError('Synthetic WebSocket connection failure');
        }
        connected();
      });

    const connecting = core.relayer.transportOpen();
    const concurrent = core.relayer.transportOpen();
    await jest.advanceTimersByTimeAsync(40_000);
    expect(attempts).toEqual(Array.from({ length: 5 }, () => RELAYS[1]));
    finishLateHandshake();
    await jest.advanceTimersByTimeAsync(1000);
    expect(closeStarted).toBe(true);
    expect(attempts).toHaveLength(5);
    acknowledgeClose();
    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all([connecting, concurrent]);
    expect(attempts).toEqual([
      ...Array.from({ length: 5 }, () => RELAYS[1]),
      RELAYS[0],
    ]);
    expect(maxLiveRelays).toBe(1);
    expect(liveConnections.size).toBe(1);
  });

  it.each([0, 1])(
    'bounds a stalled handshake drain and permits later SDK recovery on relay %s',
    async (initial) => {
      jest.useFakeTimers();
      const core = createCore(RELAYS[initial]);
      prepareCore(core);
      const hasTopics = jest
        .spyOn(core.relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      jest.spyOn(core.relayer.messages, 'init').mockResolvedValue();
      jest.spyOn(core.relayer.subscriber, 'init').mockResolvedValue();
      WalletConnectRelayController.attach(core, RELAYS[initial]);
      await core.relayer.init();
      await jest.advanceTimersByTimeAsync(0);
      hasTopics.mockReturnValue(true);
      const attempts: string[] = [];
      let finishLateHandshake = () => {};
      let lateClosed = false;
      let acknowledgeRecoveryClose = () => {};
      jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection))
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          const connection = this.connection;
          attempts.push(new URL(connection.url).origin);
          mockClose(connection);
          if (attempts.length === 1) {
            Object.assign(connection, { registering: true });
            connection.on('close', () => {
              lateClosed = true;
            });
            return new Promise<void>((resolve) => {
              finishLateHandshake = () => {
                Object.assign(connection, {
                  registering: false,
                  socket: { readyState: 1 },
                });
                connection.events.emit('open');
                this.events.emit('connect');
                resolve();
              };
            });
          }
          if (attempts.length <= 5)
            throw new OneKeyLocalError(
              'Synthetic WebSocket connection failure',
            );
          if (attempts.length === 6) {
            jest.spyOn(connection, 'close').mockImplementation(
              () =>
                new Promise<void>((resolve) => {
                  acknowledgeRecoveryClose = () => {
                    Object.assign(connection, {
                      socket: undefined,
                      registering: false,
                    });
                    connection.events.emit('close');
                    resolve();
                  };
                }),
            );
          }
          Object.assign(connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      let completed = false;
      const opening = core.relayer
        .transportOpen()
        .catch((error: unknown) => error)
        .finally(() => {
          completed = true;
        });
      await jest.advanceTimersByTimeAsync(120_000);
      expect(completed).toBe(true);
      expect(await opening).toBeInstanceOf(Error);
      expect(attempts).toEqual(
        Array.from({ length: 5 }, () => RELAYS[initial]),
      );
      expect(core.relayer.transportExplicitlyClosed).toBe(false);

      // The unsafe relay switch is abandoned, but subsequent SDK triggers can
      // retry the same endpoint while the retired registration is still pending.
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await jest.advanceTimersByTimeAsync(1000);
      expect(attempts).toHaveLength(6);
      expect(attempts[5]).toBe(RELAYS[initial]);
      expect(core.relayer.connected).toBe(true);
      const switching = core.relayer.transportOpen(RELAYS[1 - initial]);
      await jest.advanceTimersByTimeAsync(1000);
      expect(attempts).toHaveLength(6);
      finishLateHandshake();
      await jest.advanceTimersByTimeAsync(3000);
      expect(lateClosed).toBe(true);
      expect(core.relayer.connected).toBe(true);
      expect(attempts).not.toContain(RELAYS[1 - initial]);
      acknowledgeRecoveryClose();
      await jest.advanceTimersByTimeAsync(1000);
      await switching;
      expect(attempts[6]).toBe(RELAYS[1 - initial]);
      expect(core.relayer.connected).toBe(true);
    },
  );

  it.each([false, true])(
    'preserves SDK heartbeat recovery after an offline check fails; enabled=%s',
    async (enabled) => {
      jest.useFakeTimers();
      const core = createCore();
      prepareCore(core);
      const { relayer } = core;
      const hasTopics = jest
        .spyOn(relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      jest.spyOn(relayer.messages, 'init').mockResolvedValue();
      jest.spyOn(relayer.subscriber, 'init').mockResolvedValue();
      const online = jest
        .spyOn(relayer, 'confirmOnlineStateOrThrow')
        .mockRejectedValue(new OneKeyLocalError('Synthetic offline state'));
      const connect = jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      if (enabled) WalletConnectRelayController.attach(core);
      await relayer.init();
      await jest.advanceTimersByTimeAsync(0);
      hasTopics.mockReturnValue(true);

      const failing = relayer.transportOpen().catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(100);
      expect(await failing).toBeInstanceOf(Error);
      expect(relayer.transportExplicitlyClosed).toBe(false);
      expect(connect).not.toHaveBeenCalled();

      online.mockResolvedValue();
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await jest.advanceTimersByTimeAsync(100);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(relayer.connected).toBe(true);
    },
  );

  it.each([false, true])(
    'preserves close intent when an offline switch and recovery overlap; explicitClose=%s',
    async (explicitClose) => {
      jest.useFakeTimers();
      const core = createCore();
      prepareCore(core);
      const { relayer } = core;
      const hasTopics = jest
        .spyOn(relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      jest.spyOn(relayer.messages, 'init').mockResolvedValue();
      jest.spyOn(relayer.subscriber, 'init').mockResolvedValue();
      WalletConnectRelayController.attach(core);
      await relayer.init();
      await jest.advanceTimersByTimeAsync(0);
      hasTopics.mockReturnValue(true);

      const offline = new OneKeyLocalError('Synthetic offline state');
      let failOnlineCheck = () => {};
      const online = jest
        .spyOn(relayer, 'confirmOnlineStateOrThrow')
        .mockRejectedValueOnce(offline)
        .mockImplementationOnce(
          () =>
            new Promise<void>((_resolve, reject) => {
              failOnlineCheck = () => reject(offline);
            }),
        )
        .mockResolvedValue();
      const connect = jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      const opening = relayer.transportOpen().catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(100);
      expect(online).toHaveBeenCalledTimes(2);

      // An online notification can join a round whose offline check is still pending.
      const recovery = relayer.transportOpen().catch((error: unknown) => error);
      const closing = explicitClose ? relayer.transportClose() : undefined;
      failOnlineCheck();
      await jest.advanceTimersByTimeAsync(100);
      expect(await opening).toBeInstanceOf(Error);
      expect(await recovery).toBeInstanceOf(Error);
      await closing;
      expect(relayer.transportExplicitlyClosed).toBe(explicitClose);

      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await jest.advanceTimersByTimeAsync(100);
      expect(connect).toHaveBeenCalledTimes(explicitClose ? 0 : 1);
      expect(relayer.connected).toBe(!explicitClose);
    },
  );

  it('does not retry a submitted RPC when its response fails', async () => {
    jest.useFakeTimers();
    const core = createCore();
    prepareCore(core);
    const error = new OneKeyLocalError('Synthetic RPC response timeout');
    const request = jest
      .spyOn(core.relayer, 'request')
      .mockRejectedValue(error);
    WalletConnectRelayController.attach(core);
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        Object.assign(this.connection, { socket: { readyState: 1 } });
        this.events.emit('connect');
      });
    await core.relayer.transportOpen();
    await expect(
      core.relayer.request({
        method: 'irn_publish',
        params: { topic: 'test-topic' },
      }),
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps wallet and DApp retry rounds independent', async () => {
    jest.useFakeTimers();
    const clients = [
      { identity: 'wallet-test', initial: RELAYS[0], failures: 6 },
      { identity: 'dapp-test', initial: RELAYS[1], failures: 5 },
    ].map((options) => {
      const core = createCore(options.initial);
      prepareCore(core, options.identity);
      WalletConnectRelayController.attach(core, options.initial);
      const attempts: string[] = [];
      return { ...options, core, attempts };
    });
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        mockClose(this.connection);
        const url = new URL(this.connection.url);
        const client = clients.find(
          (item) => item.identity === url.searchParams.get('auth'),
        );
        if (!client) throw new OneKeyLocalError('Unknown test client');
        client.attempts.push(url.origin);
        if (client.attempts.length <= client.failures) {
          throw new OneKeyLocalError('Synthetic connection failure');
        }
        Object.assign(this.connection, { socket: { readyState: 1 } });
        this.events.emit('connect');
      });
    const connecting = Promise.all(
      clients.map(({ core }) => core.relayer.transportOpen()),
    );
    await jest.advanceTimersByTimeAsync(30_000);
    await connecting;
    expect(clients[0].attempts).toEqual([
      ...Array.from({ length: 5 }, () => RELAYS[0]),
      RELAYS[1],
      RELAYS[1],
    ]);
    expect(clients[1].attempts).toEqual([
      ...Array.from({ length: 5 }, () => RELAYS[1]),
      RELAYS[0],
    ]);
  });

  it.each(['transportOpen', 'restartTransport'] as const)(
    'cancels an open overlapping close, while allowing a later %s',
    async (reconnect) => {
      jest.useFakeTimers();
      const core = createCore();
      prepareCore(core);
      WalletConnectRelayController.attach(core);
      const connect = jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection))
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          mockClose(this.connection);
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      await core.relayer.transportOpen();
      const connection = core.relayer.provider.connection;
      let finishClose = () => {};
      jest.spyOn(connection, 'close').mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishClose = () => {
              Object.assign(connection, {
                socket: undefined,
                registering: false,
              });
              connection.events.emit('close');
              resolve();
            };
          }),
      );
      const closing = core.relayer.transportClose();
      const concurrent = core.relayer
        .transportOpen()
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(0);
      finishClose();
      await jest.advanceTimersByTimeAsync(1000);
      await closing;
      expect(await concurrent).toBeInstanceOf(OneKeyLocalError);
      expect(connect).toHaveBeenCalledTimes(1);
      expect(core.relayer.connected).toBe(false);
      expect(core.relayer.transportExplicitlyClosed).toBe(true);

      await core.relayer[reconnect]();
      expect(connect).toHaveBeenCalledTimes(2);
      expect(core.relayer.connected).toBe(true);
      expect(core.relayer.transportExplicitlyClosed).toBe(false);
    },
  );

  it('stops automatic failover after an explicit close', async () => {
    jest.useFakeTimers();
    const core = createCore();
    prepareCore(core);
    WalletConnectRelayController.attach(core);
    const attempts: string[] = [];
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        mockClose(this.connection);
        attempts.push(new URL(this.connection.url).origin);
        throw new OneKeyLocalError('Synthetic connection failure');
      });
    const connecting = core.relayer
      .transportOpen()
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(100);
    const closing = core.relayer.transportClose();
    await jest.advanceTimersByTimeAsync(60_000);
    await closing;
    expect(await connecting).toBeInstanceOf(OneKeyLocalError);
    expect(attempts).toEqual([RELAYS[0]]);
    expect(core.relayer.transportExplicitlyClosed).toBe(true);
  });

  it('closes a socket created after an explicit close during JWT generation', async () => {
    jest.useFakeTimers();
    const core = createCore();
    const signJWT = prepareCore(core);
    let finishJWT: (value: string) => void = () => {};
    signJWT.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finishJWT = resolve;
        }),
    );
    WalletConnectRelayController.attach(core);
    let attempts = 0;
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        attempts += 1;
        mockClose(this.connection);
        Object.assign(this.connection, { socket: { readyState: 1 } });
        this.events.emit('connect');
      });
    const opening = core.relayer
      .transportOpen()
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(0);
    const closing = core.relayer.transportClose();
    await jest.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(0);
    finishJWT('test-auth');
    await jest.advanceTimersByTimeAsync(1000);
    await closing;
    expect(await opening).toBeInstanceOf(OneKeyLocalError);
    expect(attempts).toBe(1);
    expect(core.relayer.connected).toBe(false);
    expect(core.relayer.transportExplicitlyClosed).toBe(true);
  });
});
