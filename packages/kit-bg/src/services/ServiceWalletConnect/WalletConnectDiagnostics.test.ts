import { EventEmitter } from 'events';

import { RELAYER_EVENTS, SUBSCRIBER_EVENTS } from '@walletconnect/core';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { WalletConnectDiagnostics } from './WalletConnectDiagnostics';

import type { IWalletKit } from '@reown/walletkit';
import type { ICore } from '@walletconnect/types';

function createCore() {
  const relayer = Object.assign(new EventEmitter(), {
    connected: true,
    connecting: false,
    transportExplicitlyClosed: false,
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
    provider: { connection: { connecting: true } },
    subscriber: Object.assign(new EventEmitter(), {
      hasAnyTopics: true,
      topics: ['topic'],
      pending: new Map(),
    }),
  });
  // Only the observer-facing SDK surface is needed for these event tests.
  const core = {
    relayer,
    pairing: { getPairings: () => [] },
  } as unknown as ICore;
  return { core, relayer };
}

describe('WalletConnect wallet diagnostics', () => {
  it.each([false, true])(
    'does not treat SDK lifecycle warnings as failed connections (previous error: %s)',
    (previousError) => {
      const diagnostics = new WalletConnectDiagnostics();
      const { core, relayer } = createCore();
      const originalWarn = relayer.logger.warn;
      diagnostics.attachCore(core);
      if (previousError) relayer.logger.error(new Error('socket failure'));
      const lastErrorAt = diagnostics.getSnapshot().lastConnectionErrorAt;
      jest.spyOn(Date, 'now').mockReturnValue((lastErrorAt ?? 0) + 1000);
      try {
        relayer.connected = false;
        relayer.logger.debug(
          {},
          'Connecting to wss://relay.walletconnect.org, attempt: 1...',
        );
        relayer.connected = true;
        relayer.logger.warn({}, 'Relayer connected 🛜');
        relayer.emit(RELAYER_EVENTS.connect);
        relayer.connected = false;
        relayer.logger.warn({}, 'Relayer disconnected');
        relayer.emit(RELAYER_EVENTS.disconnect);
        expect(diagnostics.getSnapshot()).toMatchObject({
          lastConnectionErrorAt: lastErrorAt,
          lastConnectedAt: (lastErrorAt ?? 0) + 1000,
          connectionSuccesses: 1,
          disconnections: 1,
          lastFailedConnectionAttempt: 0,
        });
        expect(
          diagnostics
            .getSnapshot()
            .events.filter((event) => event.event === 'relay_warning'),
        ).toHaveLength(0);
        expect(originalWarn).toHaveBeenCalledTimes(2);
      } finally {
        jest.restoreAllMocks();
      }
    },
  );

  it('shows a pending relay switch until closure is confirmed or the switch is cancelled', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const { core, relayer } = createCore();
    diagnostics.attachCore(core);
    relayer.emit('onekey_relay_switch_waiting');
    expect(diagnostics.getSnapshot()).toMatchObject({
      relaySwitchPending: true,
      relaySwitches: 0,
    });
    relayer.emit('onekey_relay_changed', {
      previousRelayUrl: 'wss://relay.walletconnect.com',
      relayUrl: 'wss://relay.walletconnect.org',
    });
    expect(diagnostics.getSnapshot()).toMatchObject({
      relaySwitchPending: false,
      relaySwitches: 1,
    });
    relayer.emit('onekey_relay_switch_waiting');
    relayer.emit('onekey_relay_switch_cancelled');
    expect(diagnostics.getSnapshot()).toMatchObject({
      relaySwitchPending: false,
      relaySwitches: 1,
    });
  });

  it('counts attempts and successful socket connections independently of retained records', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const { core, relayer } = createCore();
    relayer.connected = false;
    diagnostics.attachCore(core);
    relayer.logger.debug(
      {},
      'Connecting to wss://relay.walletconnect.com, attempt: 1...',
    );
    relayer.logger.debug(
      {},
      'Connecting to wss://relay.walletconnect.com, attempt: 2...',
    );
    relayer.emit(RELAYER_EVENTS.connect);
    relayer.emit('onekey_relay_changed', {
      previousRelayUrl: 'wss://relay.walletconnect.com',
      relayUrl: 'wss://relay.walletconnect.org',
      auth: 'secret-auth',
    });
    expect(JSON.stringify(diagnostics.getSnapshot())).not.toContain(
      'secret-auth',
    );
    relayer.emit(RELAYER_EVENTS.disconnect);
    relayer.logger.debug(
      {},
      'Connecting to wss://relay.walletconnect.com, attempt: 1...',
    );
    relayer.emit(RELAYER_EVENTS.connect);
    relayer.logger.debug('Unrelated SDK log');
    diagnostics.clear();
    expect(diagnostics.getSnapshot()).toMatchObject({
      connectionAttempts: 3,
      reconnectAttempts: 2,
      connectionSuccesses: 2,
      disconnections: 1,
      relaySwitches: 1,
      relayUrl: 'wss://relay.walletconnect.org',
      lastConnectedAt: expect.any(Number),
      events: [],
    });
  });

  it('observes attempt failures past ten without closing or suppressing the SDK', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const { core, relayer } = createCore();
    relayer.connected = false;
    const originalWarn = relayer.logger.warn;
    const originalDebug = relayer.logger.debug;
    diagnostics.attachCore(core);
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      relayer.logger.debug(
        `Connecting to wss://relay.walletconnect.com, attempt: ${attempt}...`,
      );
      expect(diagnostics.getSnapshot().lastFailedConnectionAttempt).toBe(
        attempt - 1,
      );
      relayer.logger.warn('Socket stalled when trying to connect');
    }
    expect(diagnostics.getSnapshot()).toMatchObject({
      connectionAttempts: 12,
      lastFailedConnectionAttempt: 12,
      transportExplicitlyClosed: false,
    });
    expect(originalWarn).toHaveBeenCalledTimes(12);
    expect(originalDebug).toHaveBeenCalledTimes(12);
    relayer.logger.debug(
      'Connecting to wss://relay.walletconnect.org, attempt: 1...',
    );
    relayer.emit(RELAYER_EVENTS.connect);
    relayer.logger.warn('An unrelated warning after connection');
    diagnostics.clear();
    expect(diagnostics.getSnapshot()).toMatchObject({
      connectionAttempts: 13,
      lastFailedConnectionAttempt: 12,
      connectionSuccesses: 1,
    });
  });

  it('captures swallowed relay retries and transport registration without retaining log data', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const first = createCore();
    const originalWarn = first.relayer.logger.warn;
    diagnostics.attachCore(first.core);
    first.relayer.logger.warn(
      {},
      'Socket stalled when trying to connect: secret-token',
    );
    expect(diagnostics.getSnapshot()).toMatchObject({
      providerConnecting: true,
      hasSubscriptionTopics: true,
      lastConnectionErrorAt: expect.any(Number),
      events: [
        expect.objectContaining({
          event: 'relay_warning',
          errorCategory: 'Timeout / expired',
        }),
      ],
    });
    expect(JSON.stringify(diagnostics.getSnapshot())).not.toContain(
      'secret-token',
    );
    expect(originalWarn).toHaveBeenCalledTimes(1);
    diagnostics.attachCore(createCore().core);
    expect(first.relayer.logger.warn).toBe(originalWarn);
    first.relayer.logger.warn({}, 'detached');
    expect(diagnostics.getSnapshot().events).toHaveLength(1);
  });

  it('reads idle state without initializing the SDK', () => {
    expect(new WalletConnectDiagnostics().getSnapshot()).toMatchObject({
      initialization: 'idle',
      listenersRegistered: false,
      events: [],
    });
  });

  it('keeps bounded, newest-first metadata and omits payloads and error details', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const secret = 'sensitive-signing-data';
    const payload = {
      id: 42,
      topic: '1234567890abcdef',
      params: {
        chainId: 'eip155:1',
        request: { method: 'personal_sign', params: [secret] },
      },
      result: secret,
      uri: `wc:topic?symKey=${secret}`,
    };
    for (let i = 0; i < 110; i += 1) {
      diagnostics.record('request', 'received', payload, {
        code: 5000,
        message: `Request rejected: ${secret}`,
        data: secret,
      });
    }
    const snapshot = diagnostics.getSnapshot();
    expect(snapshot.events).toHaveLength(100);
    expect(snapshot.events[0]).toMatchObject({
      sequence: 110,
      requestId: 42,
      topic: '12345678…',
      method: 'personal_sign',
      chainId: 'eip155:1',
      errorCode: 5000,
      errorCategory: 'Rejected / cancelled',
    });
    expect(snapshot.events[99].sequence).toBe(11);
    expect(JSON.stringify(snapshot)).not.toContain(secret);
    snapshot.events[0].event = 'mutated';
    expect(diagnostics.getSnapshot().events[0].event).toBe('received');
    diagnostics.clear();
    expect(diagnostics.getSnapshot().events).toEqual([]);
  });

  it('observes relay traffic once and detaches from a replaced core', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const first = createCore();
    const second = createCore();
    diagnostics.attachCore(first.core);
    diagnostics.attachCore(first.core);
    first.relayer.emit(RELAYER_EVENTS.message, {
      topic: '1234567890abcdef',
      message: 'encrypted-payload',
    });
    expect(diagnostics.getSnapshot().events).toHaveLength(1);
    expect(diagnostics.getSnapshot()).toMatchObject({
      connected: true,
      subscriptions: 1,
      lastRelayMessageAt: expect.any(Number),
    });
    expect(JSON.stringify(diagnostics.getSnapshot())).not.toContain(
      'encrypted-payload',
    );
    diagnostics.attachCore(second.core);
    expect(first.relayer.listenerCount(RELAYER_EVENTS.message)).toBe(0);
    first.relayer.emit(RELAYER_EVENTS.message, {});
    second.relayer.connected = false;
    second.relayer.emit(RELAYER_EVENTS.disconnect);
    expect(diagnostics.getSnapshot().events).toHaveLength(2);
    expect(diagnostics.getSnapshot().connected).toBe(false);
  });

  it('retains initialization errors when SDK state cannot be read', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const { core } = createCore();
    diagnostics.attachCore(core);
    diagnostics.setInitialization(
      'failed',
      new Error('socket connection timed out'),
    );
    Object.defineProperty(core.relayer, 'connected', {
      get: () => {
        throw new OneKeyLocalError('not initialized');
      },
    });
    expect(diagnostics.getSnapshot()).toMatchObject({
      initialization: 'failed',
      snapshotFailed: true,
      events: [expect.objectContaining({ errorCategory: 'Timeout / expired' })],
    });
  });

  it('shows missing subscriptions, expiry and waiting requests without retaining wallet data', () => {
    const diagnostics = new WalletConnectDiagnostics();
    const { core, relayer } = createCore();
    const events = new EventEmitter();
    const request = {
      id: 9,
      topic: 'missing-topic',
      params: {
        chainId: 'eip155:1',
        request: {
          method: 'personal_sign',
          params: ['private-message'],
          expiryTimestamp: 123,
        },
      },
    };
    const wallet = {
      core,
      engine: { signClient: { events } },
      getActiveSessions: () => ({
        'missing-topic': {
          topic: 'missing-topic',
          expiry: 321,
          acknowledged: true,
          namespaces: {
            eip155: {
              chains: ['eip155:1'],
              methods: ['personal_sign'],
              accounts: ['eip155:137:private-account'],
            },
          },
        },
      }),
      getPendingSessionRequests: () => [request],
    } as unknown as IWalletKit;
    diagnostics.attachWallet(wallet);
    diagnostics.attachWallet(wallet);
    diagnostics.receivedSessionEvent('session_request', request);
    const snapshot = diagnostics.getSnapshot();
    expect(snapshot.sessionDetails[0]).toMatchObject({
      subscribed: false,
      subscriptionPending: false,
      expiresAt: 321_000,
      chains: ['eip155:1', 'eip155:137'],
      methods: ['personal_sign'],
    });
    expect(snapshot.pendingRequestDetails[0]).toMatchObject({
      requestId: 9,
      method: 'personal_sign',
      expiresAt: 123_000,
      receivedAt: expect.any(Number),
    });
    expect(JSON.stringify(snapshot)).not.toContain('private-');
    events.emit('session_request_expire', { id: 9 });
    expect(diagnostics.getSnapshot().events[0]).toMatchObject({
      event: 'session_request_expire',
      requestId: 9,
    });
    expect(events.listenerCount('session_request_expire')).toBe(1);
    relayer.subscriber.emit(SUBSCRIBER_EVENTS.resubscribed);
    expect(diagnostics.getSnapshot().events[0].event).toBe(
      SUBSCRIBER_EVENTS.resubscribed,
    );
  });
});
