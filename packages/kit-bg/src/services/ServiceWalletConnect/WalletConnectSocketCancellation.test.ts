import { Core } from '@walletconnect/core';
import WsConnection from '@walletconnect/jsonrpc-ws-connection';

import { WALLET_CONNECT_RELAY_URLS } from '@onekeyhq/shared/src/walletConnect/constant';

import { ControlledWalletConnectSocket } from './testUtils/ControlledWalletConnectSocket';
import { WalletConnectDiagnostics } from './WalletConnectDiagnostics';
import { WalletConnectRelayController } from './WalletConnectRelayController';

jest.mock('@walletconnect/jsonrpc-ws-connection', () => {
  const fixture = jest.requireActual<
    typeof import('./testUtils/ControlledWalletConnectSocket')
  >('./testUtils/ControlledWalletConnectSocket');
  const original = globalThis.WebSocket;
  globalThis.WebSocket =
    fixture.ControlledWalletConnectSocket as unknown as typeof WebSocket;
  try {
    return jest.requireActual<
      typeof import('@walletconnect/jsonrpc-ws-connection')
    >('@walletconnect/jsonrpc-ws-connection');
  } finally {
    globalThis.WebSocket = original;
  }
});

describe('WalletConnect native socket cancellation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    ControlledWalletConnectSocket.instances = [];
    ControlledWalletConnectSocket.behavior = 'hang';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('cancels an unopened socket and every registration waiter without a native acknowledgment', async () => {
    const connection = new WsConnection(WALLET_CONNECT_RELAY_URLS[0]);
    const first = connection.open().catch((error: unknown) => error);
    const second = connection.open().catch((error: unknown) => error);
    expect(connection.connected).toBe(false);
    expect(connection.connecting).toBe(true);
    const socket = ControlledWalletConnectSocket.instances[0];
    const lateOpen = socket.onopen;
    const lateError = socket.onerror;
    await connection.close();
    expect(await first).toBeInstanceOf(Error);
    expect(await second).toBeInstanceOf(Error);
    expect(connection.events.listenerCount('open')).toBe(0);
    expect(connection.events.listenerCount('register_error')).toBe(0);
    expect(socket.closeCalls).toBe(1);
    expect(connection.connecting).toBe(false);

    const reopened = connection.open();
    ControlledWalletConnectSocket.instances[1].finishOpen();
    await reopened;
    lateOpen?.();
    lateError?.({ error: new Error('Late old error') });
    expect(connection.connected).toBe(true);
    expect(connection.connecting).toBe(false);
    await connection.close();
  });

  it('settles a native close that happens before the handshake opens', async () => {
    const connection = new WsConnection(WALLET_CONNECT_RELAY_URLS[0]);
    const opening = connection.open().catch((error: unknown) => error);
    ControlledWalletConnectSocket.instances[0].onclose?.();
    expect(await opening).toBeInstanceOf(Error);
    expect(connection.connecting).toBe(false);
    expect(connection.connected).toBe(false);
  });

  it('ignores queued payload and close callbacks from a retired connected socket', async () => {
    const connection = new WsConnection(WALLET_CONNECT_RELAY_URLS[0]);
    const opening = connection.open();
    const old = ControlledWalletConnectSocket.instances[0];
    old.finishOpen();
    await opening;
    const payload = jest.fn();
    connection.on('payload', payload);
    const lateMessage = old.onmessage;
    const lateClose = old.onclose;
    await connection.close();
    expect(connection.connected).toBe(false);
    const reopened = connection.open();
    ControlledWalletConnectSocket.instances[1].finishOpen();
    await reopened;
    lateMessage?.({ data: '{"id":42,"result":"retired"}' });
    lateClose?.();
    expect(payload).not.toHaveBeenCalled();
    expect(connection.connected).toBe(true);
    await connection.close();
  });

  it('cancels an active SDK handshake on explicit close and permits a fresh retry', async () => {
    const core = new Core({
      relayUrl: WALLET_CONNECT_RELAY_URLS[0],
      logger: 'silent',
    });
    jest.spyOn(core.crypto, 'signJWT').mockResolvedValue('test-auth');
    jest.spyOn(core.relayer, 'confirmOnlineStateOrThrow').mockResolvedValue();
    jest
      .spyOn(core.relayer.subscriber, 'hasAnyTopics', 'get')
      .mockReturnValue(true);
    jest.spyOn(core.relayer.subscriber, 'start').mockResolvedValue();
    jest.spyOn(core.relayer.subscriber, 'stop').mockResolvedValue();
    WalletConnectRelayController.attach(core);
    const opening = core.relayer
      .transportOpen()
      .catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(0);
    const old = ControlledWalletConnectSocket.instances[0];
    const closing = core.relayer.transportClose();
    // Finish the SDK's one-second retry backoff and the controller's next tick.
    await jest.advanceTimersByTimeAsync(2000);
    await closing;
    expect(await opening).toBeInstanceOf(Error);
    expect(core.relayer.transportExplicitlyClosed).toBe(true);
    expect(old.closeCalls).toBeGreaterThan(0);
    expect(ControlledWalletConnectSocket.instances).toHaveLength(1);
    ControlledWalletConnectSocket.behavior = 'open';
    const retry = core.relayer.transportOpen();
    await jest.advanceTimersByTimeAsync(1000);
    await retry;
    old.finishOpen();
    expect(core.relayer.connected).toBe(true);
    expect(core.relayer.transportExplicitlyClosed).toBe(false);
    await core.relayer.transportClose();
  });

  it.each([0, 1])(
    'tries five sockets on each relay despite stalled native handshakes; initial=%s',
    async (initial) => {
      const core = new Core({
        relayUrl: WALLET_CONNECT_RELAY_URLS[initial],
        logger: 'silent',
        customStoragePrefix: `native-cancellation-${initial}`,
      });
      jest.spyOn(core.crypto, 'signJWT').mockResolvedValue('test-auth');
      jest.spyOn(core.relayer, 'confirmOnlineStateOrThrow').mockResolvedValue();
      jest
        .spyOn(core.relayer.subscriber, 'hasAnyTopics', 'get')
        .mockReturnValue(true);
      jest.spyOn(core.relayer.subscriber, 'start').mockResolvedValue();
      jest.spyOn(core.relayer.subscriber, 'stop').mockResolvedValue();
      WalletConnectRelayController.attach(
        core,
        WALLET_CONNECT_RELAY_URLS[initial],
      );
      const diagnostics = new WalletConnectDiagnostics('dapp');
      diagnostics.attachCore(core);
      const opening = core.relayer
        .transportOpen()
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(300_000);
      expect(await opening).toBeInstanceOf(Error);
      const sockets = ControlledWalletConnectSocket.instances;
      expect(sockets.map((socket) => new URL(socket.url).origin)).toEqual([
        ...Array.from({ length: 5 }, () => WALLET_CONNECT_RELAY_URLS[initial]),
        ...Array.from(
          { length: 5 },
          () => WALLET_CONNECT_RELAY_URLS[1 - initial],
        ),
      ]);
      expect(sockets.every((socket) => socket.closeCalls > 0)).toBe(true);
      expect(diagnostics.getSnapshot()).toMatchObject({
        connectionAttempts: 10,
        relaySwitches: 1,
        relaySwitchPending: false,
        relayUrl: WALLET_CONNECT_RELAY_URLS[1 - initial],
      });

      ControlledWalletConnectSocket.behavior = 'open';
      const recovery = core.relayer.transportOpen();
      await jest.advanceTimersByTimeAsync(1000);
      await recovery;
      expect(new URL(sockets[10].url).origin).toBe(
        WALLET_CONNECT_RELAY_URLS[initial],
      );
      for (const old of sockets.slice(0, 10)) old.finishOpen();
      expect(core.relayer.connected).toBe(true);
      await core.relayer.transportClose();
    },
  );
});
