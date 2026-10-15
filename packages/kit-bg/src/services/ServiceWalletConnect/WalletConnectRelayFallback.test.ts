import { Core, SUBSCRIBER_EVENTS } from '@walletconnect/core';
import { HEARTBEAT_EVENTS } from '@walletconnect/heartbeat';
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider';
import WsConnection from '@walletconnect/jsonrpc-ws-connection';
import SignClient from '@walletconnect/sign-client';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { WALLET_CONNECT_RELAY_URLS } from '@onekeyhq/shared/src/walletConnect/constant';

import walletConnectClient from './walletConnectClient';
import {
  WalletConnectDiagnostics,
  dappSideWalletConnectDiagnostics,
  walletConnectDiagnostics,
} from './WalletConnectDiagnostics';
import { WalletConnectRelayController } from './WalletConnectRelayController';
import { RELAYER_EVENTS } from './walletConnectSdkEvents';

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

describe('WalletConnect application relay controller with the SDK transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([0, 1])(
    'routes initial and queued pairing retries through ten attempts each; initial=%s',
    async (initial) => {
      jest.useFakeTimers();
      const core = createCore(RELAYS[initial]);
      prepareCore(core);
      const { relayer } = core;
      jest
        .spyOn(relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      WalletConnectRelayController.attach(core, RELAYS[initial]);
      const diagnostics = new WalletConnectDiagnostics('wallet');
      diagnostics.attachCore(core);
      const subscribe = jest.spyOn(relayer.subscriber, 'subscribe');
      const attempts: string[] = [];
      jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection))
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          mockClose(this.connection);
          attempts.push(new URL(this.connection.url).origin);
          throw new OneKeyLocalError('Synthetic connection failure');
        });
      const first = relayer
        .subscribe('first-topic')
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(1000);
      const retry = relayer
        .subscribe('retry-topic')
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(80_000);
      expect(await first).toBeInstanceOf(Error);
      expect(await retry).toBeInstanceOf(Error);
      expect(attempts).toEqual(
        Array.from(
          { length: 20 },
          (_, index) => RELAYS[(initial + Math.floor(index / 5)) % 2],
        ),
      );
      // No SDK subscription timer runs during connection recovery, so neither
      // caller can leave a timed-out subscribe that cancels the newer cycle.
      expect(subscribe).not.toHaveBeenCalled();
      expect(diagnostics.getSnapshot()).toMatchObject({
        connectionAttempts: 20,
        lastFailedConnectionAttempt: 20,
        relaySwitches: 3,
      });
    },
  );

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
      if (firstPairing) {
        expect(relayer.subscriber.pending.has('test-topic')).toBe(false);
      }
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
      if (firstPairing) {
        // Socket recovery must not resurrect the rejected pairing request.
        expect(relayer.subscriber.pending.has('test-topic')).toBe(false);
      }
    },
  );

  it.each([false, true])(
    'does not retain a new topic when recovery disconnects after socket open; existing=%s',
    async (existing) => {
      jest.useFakeTimers();
      const core = createCore();
      prepareCore(core);
      const { relayer } = core;
      jest.spyOn(relayer.subscriber, 'hasAnyTopics', 'get').mockRestore();
      jest.spyOn(relayer.subscriber, 'start').mockRestore();
      jest.spyOn(relayer.subscriber, 'stop').mockRestore();
      jest
        .spyOn(core.crypto, 'getClientId')
        .mockResolvedValue('test-client-id');
      const getItem = jest
        .spyOn(core.storage, 'getItem')
        .mockResolvedValue(undefined);
      jest.spyOn(core.storage, 'setItem').mockResolvedValue();
      jest.spyOn(relayer.messages, 'init').mockResolvedValue();
      WalletConnectRelayController.attach(core);
      await relayer.init();
      await jest.advanceTimersByTimeAsync(0);

      getItem.mockResolvedValue(
        existing
          ? [
              {
                topic: 'existing-topic',
                id: 'existing-subscription',
                relay: { protocol: 'irn' },
              },
            ]
          : undefined,
      );
      let disconnectFirstProvider: (() => Promise<void>) | undefined;
      let attempts = 0;
      jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection)) {
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          }
          mockClose(this.connection);
          attempts += 1;
          if (attempts > 1 && attempts <= 10) {
            throw new OneKeyLocalError('Synthetic connection failure');
          }
          if (attempts === 1)
            disconnectFirstProvider = async () => {
              await this.connection.close();
              this.events.emit('disconnect');
            };
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      let completeFirstRecovery: (ids: string[]) => void = () => {};
      const firstRecovery = new Promise<string[]>((resolve) => {
        completeFirstRecovery = resolve;
      });
      const request = jest.spyOn(JsonRpcProvider.prototype, 'request');
      const disconnect = async () => {
        if (!disconnectFirstProvider)
          throw new OneKeyLocalError('Missing recovery provider');
        await disconnectFirstProvider();
      };
      if (existing)
        request.mockImplementationOnce(() => {
          // This runs inside real rpcBatchSubscribe while Step B is awaiting it.
          void disconnect();
          return firstRecovery;
        });
      else
        getItem.mockImplementationOnce(async () => {
          // A first pairing can also disconnect during Subscriber.restore().
          await disconnect();
          return undefined;
        });
      request.mockImplementation(async (payload) =>
        payload.method === 'irn_batchSubscribe'
          ? ['existing-subscription']
          : 'test-subscription',
      );

      const first = relayer
        .subscribe('abandoned-topic')
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(40_000);
      expect(await first).toBeInstanceOf(Error);
      expect(attempts).toBe(10);
      if (existing)
        expect(request.mock.calls[0][0].method).toBe('irn_batchSubscribe');
      else expect(request).not.toHaveBeenCalled();
      expect(relayer.subscriber.pending.has('abandoned-topic')).toBe(false);
      expect(await relayer.subscriber.isKnownTopic('abandoned-topic')).toBe(
        false,
      );

      // Settle the old legitimate restore before its own 60-second timeout.
      completeFirstRecovery(['existing-subscription']);
      await jest.advanceTimersByTimeAsync(0);
      core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
      await jest.advanceTimersByTimeAsync(1000);
      expect(attempts).toBe(11);
      expect(relayer.connected).toBe(true);
      expect(await relayer.subscriber.isKnownTopic('abandoned-topic')).toBe(
        false,
      );
      if (existing)
        expect(await relayer.subscriber.isSubscribed('existing-topic')).toBe(
          true,
        );
      await relayer.transportClose();
    },
  );

  it('waits for socket recovery before subscribing the queued pairing', async () => {
    jest.useFakeTimers();
    const core = createCore();
    prepareCore(core);
    const { relayer } = core;
    jest.spyOn(relayer.subscriber, 'hasAnyTopics', 'get').mockRestore();
    jest.spyOn(core.crypto, 'getClientId').mockResolvedValue('test-client-id');
    jest.spyOn(core.storage, 'getItem').mockResolvedValue(undefined);
    jest.spyOn(core.storage, 'setItem').mockResolvedValue();
    jest.spyOn(relayer.messages, 'init').mockResolvedValue();
    WalletConnectRelayController.attach(core);
    await relayer.init();
    await jest.advanceTimersByTimeAsync(0);

    const connectedTopics: string[][] = [];
    relayer.on(RELAYER_EVENTS.connect, () => {
      connectedTopics.push([...relayer.subscriber.pending.keys()]);
    });
    let attempts = 0;
    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        mockClose(this.connection);
        attempts += 1;
        if (attempts <= 10) {
          throw new OneKeyLocalError('Synthetic connection failure');
        }
        Object.assign(this.connection, { socket: { readyState: 1 } });
        this.events.emit('connect');
      });
    const request = jest
      .spyOn(JsonRpcProvider.prototype, 'request')
      .mockResolvedValue('test-subscription');
    const first = relayer
      .subscribe('abandoned-topic')
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(1000);
    const retry = relayer.subscribe('current-topic');
    await jest.advanceTimersByTimeAsync(40_000);
    expect(await first).toBeInstanceOf(Error);
    expect(await retry).toEqual(expect.any(String));
    expect(attempts).toBe(11);
    expect(connectedTopics).toEqual([[]]);
    expect(relayer.subscriber.pending.has('abandoned-topic')).toBe(false);
    expect(await relayer.subscriber.isSubscribed('current-topic')).toBe(true);

    // Exercise the real pending checker beyond its stalled-RPC timeout window.
    core.heartbeat.events.emit(HEARTBEAT_EVENTS.pulse);
    await jest.advanceTimersByTimeAsync(61_000);
    expect(request.mock.calls.map(([payload]) => payload.method)).toEqual([
      'irn_subscribe',
    ]);
    expect(relayer.connected).toBe(true);
    expect(attempts).toBe(11);
    await relayer.transportClose();
  });

  it('does not revive a topic subscribed while connected after SDK cleanup and reconnect', async () => {
    jest.useFakeTimers();
    const core = createCore();
    prepareCore(core);
    const { relayer } = core;
    jest.spyOn(relayer.subscriber, 'hasAnyTopics', 'get').mockRestore();
    jest.spyOn(core.crypto, 'getClientId').mockResolvedValue('test-client-id');
    jest.spyOn(core.storage, 'getItem').mockResolvedValue(undefined);
    jest.spyOn(core.storage, 'setItem').mockResolvedValue();
    jest.spyOn(relayer.messages, 'init').mockResolvedValue();
    jest.spyOn(relayer.messages, 'del').mockResolvedValue();
    WalletConnectRelayController.attach(core);
    await relayer.init();
    await jest.advanceTimersByTimeAsync(0);

    jest
      .spyOn(JsonRpcProvider.prototype, 'connect')
      .mockImplementation(async function connect(this: JsonRpcProvider) {
        if (!(this.connection instanceof WsConnection)) {
          throw new OneKeyLocalError('Expected the SDK WebSocket transport');
        }
        mockClose(this.connection);
        Object.assign(this.connection, { socket: { readyState: 1 } });
        this.events.emit('connect');
      });
    jest
      .spyOn(JsonRpcProvider.prototype, 'request')
      .mockResolvedValue('test-subscription');

    await relayer.request({ method: 'irn_ping', params: {} });
    await relayer.subscribe('retired-topic');
    expect(await relayer.subscriber.isSubscribed('retired-topic')).toBe(true);
    // UniversalProvider retry cleanup calls the subscriber directly.
    await relayer.subscriber.unsubscribe('retired-topic');
    expect(await relayer.subscriber.isKnownTopic('retired-topic')).toBe(false);
    await relayer.provider.connection.close();

    const existing = { topic: 'sdk-owned-topic', relay: { protocol: 'irn' } };
    relayer.subscriber.pending.set(existing.topic, existing);
    const connectedTopics: string[][] = [];
    relayer.on(RELAYER_EVENTS.connect, () => {
      connectedTopics.push([...relayer.subscriber.pending.keys()]);
    });
    await relayer.subscribe('replacement-topic');
    expect(connectedTopics).toEqual([['sdk-owned-topic']]);
    expect(await relayer.subscriber.isKnownTopic('retired-topic')).toBe(false);
    expect(await relayer.subscriber.isSubscribed('replacement-topic')).toBe(
      true,
    );
    expect(relayer.subscriber.pending.get(existing.topic)).toBe(existing);
    await relayer.transportClose();
  });

  it.each([false, true])(
    'submits a concurrent pairing independently after the first fails; secondFails=%s',
    async (secondFails) => {
      jest.useFakeTimers();
      const core = createCore();
      prepareCore(core);
      const { relayer } = core;
      jest
        .spyOn(relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(false);
      jest.spyOn(relayer.messages, 'init').mockResolvedValue();
      jest.spyOn(relayer.subscriber, 'init').mockResolvedValue();
      WalletConnectRelayController.attach(core);
      await relayer.init();
      await jest.advanceTimersByTimeAsync(0);

      const connect = jest
        .spyOn(JsonRpcProvider.prototype, 'connect')
        .mockImplementation(async function connect(this: JsonRpcProvider) {
          if (!(this.connection instanceof WsConnection)) {
            throw new OneKeyLocalError('Expected the SDK WebSocket transport');
          }
          mockClose(this.connection);
          Object.assign(this.connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      const firstError = new OneKeyLocalError('First subscription failed');
      const secondError = new OneKeyLocalError('Second subscription failed');
      let failFirst = () => {};
      const subscribe = jest
        .spyOn(relayer.subscriber, 'subscribe')
        .mockImplementationOnce(
          () =>
            new Promise<string>((_resolve, reject) => {
              failFirst = () => reject(firstError);
            }),
        )
        .mockImplementationOnce(async (topic) => {
          if (secondFails) throw secondError;
          relayer.subscriber.events.emit(SUBSCRIBER_EVENTS.created, { topic });
          return 'second-subscription';
        });

      const first = relayer
        .subscribe('first-topic')
        .catch((error: unknown) => error);
      const second = relayer
        .subscribe('second-topic')
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(0);
      expect(subscribe.mock.calls.map(([topic]) => topic)).toEqual([
        'first-topic',
      ]);

      failFirst();
      await jest.advanceTimersByTimeAsync(0);
      expect(await first).toBe(firstError);
      expect(await second).toBe(
        secondFails ? secondError : 'second-subscription',
      );
      expect(subscribe.mock.calls.map(([topic]) => topic)).toEqual([
        'first-topic',
        'second-topic',
      ]);
      expect(connect).toHaveBeenCalledTimes(1);
      await relayer.transportClose();
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
    'bounds a genuine cleanup failure and switches after cleanup recovers; initial=%s',
    async (initial) => {
      jest.useFakeTimers();
      const core = createCore(RELAYS[initial]);
      prepareCore(core);
      WalletConnectRelayController.attach(core, RELAYS[initial]);
      const attempts: string[] = [];
      let acknowledgeClose = () => {};
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
            jest.spyOn(connection, 'close').mockImplementation(
              () =>
                new Promise<void>((resolve) => {
                  acknowledgeClose = () => {
                    Object.assign(connection, {
                      socket: undefined,
                      registering: false,
                    });
                    connection.events.emit('close');
                    resolve();
                  };
                }),
            );
            return new Promise<void>(() => {});
          }
          if (attempts.length <= 5)
            throw new OneKeyLocalError('Synthetic connection failure');
          Object.assign(connection, { socket: { readyState: 1 } });
          this.events.emit('connect');
        });
      const opening = core.relayer
        .transportOpen()
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(120_000);
      expect(await opening).toMatchObject({
        message: 'WalletConnect switch timed out during relay cleanup',
      });
      expect(attempts).toEqual(
        Array.from({ length: 5 }, () => RELAYS[initial]),
      );
      acknowledgeClose();
      await jest.advanceTimersByTimeAsync(0);
      const recovery = core.relayer.transportOpen();
      await jest.advanceTimersByTimeAsync(1000);
      await recovery;
      expect(attempts[5]).toBe(RELAYS[1 - initial]);
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
