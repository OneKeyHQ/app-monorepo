import { RELAYER_EVENTS, SUBSCRIBER_EVENTS } from '@walletconnect/core';

import {
  WALLET_CONNECT_RELAY_URL,
  WALLET_CONNECT_RELAY_URLS,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IWalletConnectDiagnosticEvent,
  IWalletConnectDiagnostics,
} from '@onekeyhq/shared/src/walletConnect/diagnostics';

import type { IWalletKit } from '@reown/walletkit';
import type { ICore, SignClientTypes } from '@walletconnect/types';

const EVENT_LIMIT = 100;
const DETAIL_LIMIT = 20;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function identifier(value: unknown) {
  return typeof value === 'string' &&
    /^[a-zA-Z][a-zA-Z0-9_:.-]{0,79}$/.test(value)
    ? value
    : undefined;
}

// Only protocol metadata is retained. Never copy params, results, URIs or
// arbitrary error messages: any of them can contain signing data or secrets.
function metadata(payload: unknown) {
  const value = asRecord(payload);
  const params = asRecord(value.params);
  const request = asRecord(params.request);
  const topic = value.topic ?? params.topic;
  return {
    relayUrl: WALLET_CONNECT_RELAY_URLS.find((url) => url === value.relayUrl),
    previousRelayUrl: WALLET_CONNECT_RELAY_URLS.find(
      (url) => url === value.previousRelayUrl,
    ),
    requestId:
      typeof value.id === 'number' && Number.isFinite(value.id)
        ? value.id
        : undefined,
    topic:
      typeof topic === 'string' && /^[a-zA-Z0-9-]+$/.test(topic)
        ? `${topic.slice(0, 8)}…`
        : undefined,
    method: identifier(request.method),
    chainId: identifier(params.chainId),
  };
}

function errorMetadata(error: unknown) {
  const value = asRecord(error);
  const message = typeof value.message === 'string' ? value.message : '';
  let errorCategory = 'Unknown error (details omitted)';
  if (
    /decode|decrypt|cipher|sym.?key|no matching key|keychain/i.test(message)
  ) {
    errorCategory = 'Decryption / session key';
  } else if (/storage|database|indexeddb|mmkv/i.test(message)) {
    errorCategory = 'Storage';
  } else if (
    /unauthorized|forbidden|project.?id|authentication/i.test(message)
  ) {
    errorCategory = 'Authentication / project';
  } else if (/timeout|timed out|socket stalled|expired/i.test(message)) {
    errorCategory = 'Timeout / expired';
  } else if (/unsupported|not supported|method not found/i.test(message)) {
    errorCategory = 'Unsupported chain / method';
  } else if (/reject|denied|cancel/i.test(message)) {
    errorCategory = 'Rejected / cancelled';
  } else if (/network|socket|relay|connect|offline/i.test(message)) {
    errorCategory = 'Connection / transport';
  }
  return {
    errorCode:
      typeof value.code === 'number' && Number.isFinite(value.code)
        ? value.code
        : undefined,
    errorCategory,
  };
}

export class WalletConnectDiagnostics {
  private core?: ICore;

  private wallet?: IWalletKit;

  private cleanup?: () => void;

  private cleanupWallet?: () => void;

  private requestReceivedAt = new Map<number, number>();

  private sequence = 0;

  private events: IWalletConnectDiagnosticEvent[] = [];

  private startedAt = Date.now();

  private initialization: IWalletConnectDiagnostics['initialization'] = 'idle';

  private listenersRegistered = false;

  private lastRelayMessageAt?: number;

  private lastSessionEventAt?: number;

  private lastPublishAt?: number;

  private lastConnectionErrorAt?: number;

  private lastConnectedAt?: number;

  private connectionAttempts = 0;

  private connectionAttemptPending = false;

  private lastFailedConnectionAttempt = 0;

  private connectionSuccesses = 0;

  private disconnections = 0;

  private relaySwitches = 0;

  private relaySwitchPending = false;

  private relayUrl: string = WALLET_CONNECT_RELAY_URL;

  record(
    stage: IWalletConnectDiagnosticEvent['stage'],
    event: string,
    payload?: unknown,
    error?: unknown,
  ) {
    if (stage === 'connection' && error !== undefined) {
      this.lastConnectionErrorAt = Date.now();
    }
    this.sequence += 1;
    this.events.push({
      sequence: this.sequence,
      timestamp: Date.now(),
      stage,
      event,
      level: error === undefined ? 'info' : 'error',
      ...metadata(payload),
      ...(error === undefined ? {} : errorMetadata(error)),
    });
    if (this.events.length > EVENT_LIMIT) {
      this.events.splice(0, this.events.length - EVENT_LIMIT);
    }
  }

  setInitialization(
    state: IWalletConnectDiagnostics['initialization'],
    error?: unknown,
  ) {
    this.initialization = state;
    this.record('connection', `initialize_${state}`, undefined, error);
  }

  setListenersRegistered(registered: boolean) {
    this.listenersRegistered = registered;
  }

  receivedSessionEvent(event: string, payload: unknown) {
    this.lastSessionEventAt = Date.now();
    const { requestId } = metadata(payload);
    if (event === 'session_request' && requestId !== undefined) {
      this.requestReceivedAt.set(requestId, this.lastSessionEventAt);
      if (this.requestReceivedAt.size > EVENT_LIMIT) {
        const oldestId = this.requestReceivedAt.keys().next().value;
        if (oldestId !== undefined) {
          this.requestReceivedAt.delete(oldestId);
        }
      }
    }
    this.record('session', event, payload);
  }

  attachCore(core: ICore) {
    if (this.core === core) {
      return;
    }
    this.cleanup?.();
    this.core = core;
    const { relayer } = core;
    // The SDK swallows connection-attempt failures after logging a warning.
    // Observe those calls even when its configured console level hides warnings.
    const loggerCleanup = (['debug', 'warn', 'error'] as const).map((level) => {
      const original = relayer.logger[level];
      const observer = (...args: unknown[]) => {
        if (level === 'debug') {
          // Core 2.21.9 has no attempt event; this log precedes each new socket.
          if (
            args.some(
              (arg) =>
                typeof arg === 'string' &&
                /^Connecting to .+, attempt: \d+\.\.\.$/.test(arg),
            )
          ) {
            this.connectionAttempts += 1;
            this.connectionAttemptPending = true;
            this.record('connection', 'relay_connecting');
          }
        } else if (
          !(
            level === 'warn' &&
            args.some(
              (arg) =>
                typeof arg === 'string' &&
                /^Relayer (connected|disconnected)\b/.test(arg),
            )
          )
        ) {
          // SDK lifecycle warnings are already captured by the relay events.
          if (
            level === 'warn' &&
            this.connectionAttemptPending &&
            !relayer.connected
          ) {
            this.connectionAttemptPending = false;
            this.lastFailedConnectionAttempt = this.connectionAttempts;
          }
          const error = args.find(
            (arg) => typeof asRecord(arg).message === 'string',
          ) ?? {
            message: args.filter((arg) => typeof arg === 'string').join(' '),
          };
          const category = errorMetadata(error).errorCategory;
          this.record(
            [
              'Connection / transport',
              'Timeout / expired',
              'Authentication / project',
            ].includes(category)
              ? 'connection'
              : 'relay',
            level === 'warn' ? 'relay_warning' : 'relay_error',
            undefined,
            error,
          );
        }
        Reflect.apply(original, relayer.logger, args);
      };
      relayer.logger[level] = observer;
      return () => {
        if (relayer.logger[level] === observer) {
          relayer.logger[level] = original;
        }
      };
    });
    const listeners: Array<[string, (payload?: unknown) => void]> = [
      [
        'onekey_relay_switch_waiting',
        () => {
          this.relaySwitchPending = true;
          this.record('connection', 'relay_switch_waiting_for_close');
        },
      ],
      [
        'onekey_relay_switch_cancelled',
        () => {
          this.relaySwitchPending = false;
          this.record('connection', 'relay_switch_cancelled');
        },
      ],
      [
        'onekey_relay_changed',
        (payload) => {
          const { relayUrl } = metadata(payload);
          if (relayUrl) {
            this.relaySwitchPending = false;
            this.relayUrl = relayUrl;
            this.relaySwitches += 1;
            this.record('connection', 'relay_switched', payload);
          }
        },
      ],
      ...[
        RELAYER_EVENTS.connect,
        RELAYER_EVENTS.disconnect,
        RELAYER_EVENTS.transport_closed,
        RELAYER_EVENTS.connection_stalled,
      ].map((event): [string, () => void] => [
        event,
        () => {
          if (event === RELAYER_EVENTS.connect) {
            this.connectionAttemptPending = false;
            this.connectionSuccesses += 1;
            this.lastConnectedAt = Date.now();
          } else if (event === RELAYER_EVENTS.disconnect) {
            this.disconnections += 1;
          }
          this.record('connection', event);
        },
      ]),
      [
        RELAYER_EVENTS.error,
        (error) => this.record('connection', 'relay_error', undefined, error),
      ],
      [
        RELAYER_EVENTS.message,
        (payload) => {
          this.lastRelayMessageAt = Date.now();
          this.record('relay', 'message_received', payload);
        },
      ],
      [
        RELAYER_EVENTS.publish,
        (payload) => {
          this.lastPublishAt = Date.now();
          this.record('relay', 'publish_acknowledged', payload);
        },
      ],
      [
        RELAYER_EVENTS.message_ack,
        (payload) => {
          const { error } = asRecord(payload);
          this.record('relay', 'rpc_acknowledged', payload, error);
        },
      ],
    ];
    listeners.forEach(([event, listener]) => relayer.on(event, listener));
    const subscriptionListeners = Object.values(SUBSCRIBER_EVENTS).map(
      (event): [string, (payload?: unknown) => void] => [
        event,
        (payload) => this.record('relay', event, payload),
      ],
    );
    subscriptionListeners.forEach(([event, listener]) =>
      relayer.subscriber.on(event, listener),
    );
    this.cleanup = () => {
      loggerCleanup.forEach((cleanup) => cleanup());
      listeners.forEach(([event, listener]) => relayer.off(event, listener));
      subscriptionListeners.forEach(([event, listener]) =>
        relayer.subscriber.off(event, listener),
      );
    };
  }

  attachWallet(wallet: IWalletKit) {
    if (this.wallet === wallet) {
      return;
    }
    this.cleanupWallet?.();
    this.wallet = wallet;
    this.attachCore(wallet.core);
    const events: SignClientTypes.Event[] = [
      'session_expire',
      'proposal_expire',
      'session_request_expire',
      'session_update',
      'session_extend',
      'session_connect',
    ];
    const listeners = events.map(
      (event): [SignClientTypes.Event, (payload: unknown) => void] => [
        event,
        (payload) => this.record('session', event, payload),
      ],
    );
    const emitter = wallet.engine.signClient.events;
    listeners.forEach(([event, listener]) => emitter.on(event, listener));
    this.cleanupWallet = () => {
      listeners.forEach(([event, listener]) => emitter.off(event, listener));
    };
  }

  clear() {
    this.events = [];
  }

  getSnapshot(): IWalletConnectDiagnostics {
    const snapshot: IWalletConnectDiagnostics = {
      capturedAt: Date.now(),
      startedAt: this.startedAt,
      initialization: this.initialization,
      listenersRegistered: this.listenersRegistered,
      connectionAttempts: this.connectionAttempts,
      lastFailedConnectionAttempt: this.lastFailedConnectionAttempt,
      reconnectAttempts: Math.max(0, this.connectionAttempts - 1),
      connectionSuccesses: this.connectionSuccesses,
      disconnections: this.disconnections,
      relaySwitches: this.relaySwitches,
      relaySwitchPending: this.relaySwitchPending,
      relayUrl: this.relayUrl,
      snapshotFailed: false,
      lastRelayMessageAt: this.lastRelayMessageAt,
      lastSessionEventAt: this.lastSessionEventAt,
      lastPublishAt: this.lastPublishAt,
      lastConnectionErrorAt: this.lastConnectionErrorAt,
      lastConnectedAt: this.lastConnectedAt,
      sessionDetails: [],
      pendingRequestDetails: [],
      detailLimit: DETAIL_LIMIT,
      events: this.events.toReversed().map((event) => ({ ...event })),
      eventLimit: EVENT_LIMIT,
    };
    // SDK getters may be unavailable while initialization is in progress.
    try {
      if (this.core) {
        const { relayer } = this.core;
        snapshot.connected = relayer.connected;
        snapshot.connecting = relayer.connecting;
        snapshot.providerConnecting = relayer.provider?.connection?.connecting;
        snapshot.hasSubscriptionTopics = relayer.subscriber.hasAnyTopics;
        snapshot.transportExplicitlyClosed = relayer.transportExplicitlyClosed;
        snapshot.subscriptions = relayer.subscriber.topics.length;
        snapshot.pendingSubscriptions = relayer.subscriber.pending.size;
        snapshot.pairings = this.core.pairing.getPairings().length;
      }
      if (this.wallet) {
        const sessions = Object.values(this.wallet.getActiveSessions());
        const pendingRequests = this.wallet.getPendingSessionRequests();
        const subscriber = this.wallet.core.relayer.subscriber;
        const subscribedTopics = new Set(subscriber.topics);
        snapshot.sessions = sessions.length;
        snapshot.pendingRequests = pendingRequests.length;
        snapshot.sessionDetails = sessions
          .slice(0, DETAIL_LIMIT)
          .map((session) => ({
            topic: metadata(session).topic,
            expiresAt: session.expiry * 1000,
            acknowledged: session.acknowledged,
            subscribed: subscribedTopics.has(session.topic),
            subscriptionPending: subscriber.pending.has(session.topic),
            chains: [
              ...new Set(
                Object.values(session.namespaces).flatMap((ns) => [
                  ...(ns.chains ?? []),
                  ...ns.accounts
                    .filter((account) => account.split(':').length === 3)
                    .map((account) => account.split(':').slice(0, 2).join(':')),
                ]),
              ),
            ]
              .filter((chain) => identifier(chain) !== undefined)
              .slice(0, DETAIL_LIMIT),
            methods: [
              ...new Set(
                Object.values(session.namespaces).flatMap((ns) => ns.methods),
              ),
            ]
              .filter((method) => identifier(method) !== undefined)
              .slice(0, 40),
          }));
        snapshot.pendingRequestDetails = pendingRequests
          .slice(0, DETAIL_LIMIT)
          .map((request) => ({
            ...metadata(request),
            receivedAt: this.requestReceivedAt.get(request.id),
            expiresAt:
              request.params.request.expiryTimestamp === undefined
                ? undefined
                : request.params.request.expiryTimestamp * 1000,
          }));
      }
    } catch (_error) {
      snapshot.snapshotFailed = true;
    }
    return snapshot;
  }
}

export const walletConnectDiagnostics = new WalletConnectDiagnostics();
export const dappSideWalletConnectDiagnostics = new WalletConnectDiagnostics();
