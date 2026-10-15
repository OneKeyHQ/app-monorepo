import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  WALLET_CONNECT_RELAY_URL,
  WALLET_CONNECT_RELAY_URLS,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IWalletConnectConnectionLog,
  IWalletConnectRelayOperation,
} from '@onekeyhq/shared/src/walletConnect/diagnostics';

import { RELAYER_EVENTS } from './walletConnectSdkEvents';

import type { Relayer } from '@walletconnect/core';
import type { IJsonRpcConnection } from '@walletconnect/jsonrpc-utils';
import type { ICore } from '@walletconnect/types';

// Core makes up to five attempts per round. Limit only this invocation's
// added fallback work; later SDK reconnect triggers receive a fresh budget.
const MAX_RELAY_ROUNDS = 2;
const RELAY_DRAIN_TIMEOUT_MS = 15_000;

type IConnectionCycle = {
  id: number;
  round: number;
  remainingRounds: number;
};
type IDrainContext = {
  operation: IWalletConnectRelayOperation;
  targetRelayUrl?: string;
};

type IConnection = {
  id: number;
  connection: IJsonRpcConnection;
  settled: Promise<void>;
  registrationSettled: boolean;
  settle: () => void;
  cleanup: () => void;
  closing?: Promise<void>;
};

// Mirrors createExpiringPromise from '@walletconnect/utils'. Importing the
// helper statically would drag the whole utils bundle (es-toolkit, ox, ...)
// into the background startup graph.
function createExpiringPromise<T>(
  promise: Promise<T>,
  expiry: number,
  expireErrorMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new OneKeyLocalError(expireErrorMessage)),
      expiry,
    );
    promise.then(
      (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

// Structural stand-in for `relayer instanceof Relayer`: the class lives in the
// SDK's single bundled entry, which must stay out of the background startup
// graph. Every member the controller binds or patches has to be present.
type ISdkRelayer = ICore['relayer'] &
  Pick<Relayer, 'transportDisconnect'> & {
    // SDK subscribe/request also call this method without using transportOpen.
    connect: (relayUrl?: string) => Promise<void>;
  };
function isSdkRelayer(relayer: ICore['relayer']): relayer is ISdkRelayer {
  // Two @walletconnect/jsonrpc-types copies make IRelayer and Relayer
  // non-overlapping for TS; the check below is purely structural.
  const candidate = relayer as unknown as Partial<ISdkRelayer>;
  return (
    typeof candidate.transportOpen === 'function' &&
    typeof candidate.transportClose === 'function' &&
    typeof candidate.transportDisconnect === 'function' &&
    typeof candidate.connect === 'function' &&
    typeof candidate.restartTransport === 'function' &&
    typeof candidate.request === 'function' &&
    typeof candidate.subscribe === 'function' &&
    typeof candidate.on === 'function' &&
    !!candidate.subscriber &&
    !!candidate.logger &&
    !!candidate.events
  );
}

// Serialize SDK socket acquisition around relay changes. A complete SDK retry
// round finishes before the next endpoint is selected; SDK internals stay intact.
export class WalletConnectRelayController {
  private static controllers = new WeakMap<
    ICore['relayer'],
    WalletConnectRelayController
  >();

  static attach(core: ICore, initialRelayUrl = WALLET_CONNECT_RELAY_URL) {
    const existing = this.controllers.get(core.relayer);
    if (existing) return existing;
    const controller = new WalletConnectRelayController(core, initialRelayUrl);
    this.controllers.set(core.relayer, controller);
    return controller;
  }

  private currentRelayUrl: string;

  private opening?: Promise<void>;

  private closing?: Promise<void>;

  private draining?: Promise<void>;

  private generation = 0;

  private cycleNumber = 0;

  private connectionNumber = 0;

  private activeCycle?: IConnectionCycle;

  private drainState?: Partial<IWalletConnectConnectionLog>;

  private drainStartedAt?: number;

  private failed = false;

  private attemptStarted = false;

  private switching = false;

  private initialSubscription?: Promise<string>;

  private reconnectWanted = false;

  private connections = new Map<IJsonRpcConnection, IConnection>();

  private readonly connectTransport: ISdkRelayer['connect'];

  private readonly closeTransport: ICore['relayer']['transportClose'];

  private readonly disconnectTransport: Relayer['transportDisconnect'];

  private constructor(
    private readonly core: ICore,
    initialRelayUrl = WALLET_CONNECT_RELAY_URL,
  ) {
    this.currentRelayUrl = initialRelayUrl;
    const { relayer } = core;
    this.closeTransport = relayer.transportClose.bind(relayer);
    const request = relayer.request.bind(relayer);
    const subscribe = relayer.subscribe.bind(relayer);
    if (!isSdkRelayer(relayer)) {
      throw new OneKeyLocalError('Expected the WalletConnect SDK relayer');
    }
    this.disconnectTransport = relayer.transportDisconnect.bind(relayer);
    this.connectTransport = relayer.connect.bind(relayer);
    const sdkConnecting: (() => boolean) | undefined =
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(relayer),
        'connecting',
      )?.get?.bind(relayer);
    Object.defineProperty(relayer, 'connecting', {
      get: () => Boolean(this.opening || sdkConnecting?.()),
    });

    // Route the SDK's direct connect calls through the same round budget and
    // relay selection as heartbeat, network recovery and application retries.
    relayer.connect = (url) => this.open(url, true);
    relayer.transportOpen = (url) => this.open(url);
    relayer.transportClose = () => this.close();
    relayer.restartTransport = async (url) => {
      const opening = this.opening;
      await this.close('restart');
      await opening?.catch(() => undefined);
      await this.open(url ?? this.currentRelayUrl);
    };
    relayer.request = async (...args) => {
      if (this.closing) {
        throw new OneKeyLocalError('WalletConnect connection cancelled');
      }
      await this.open(undefined, true);
      // Never replay an RPC after it has been handed to the SDK.
      return request(...args);
    };
    relayer.subscribe = async (...args) => {
      while (this.initialSubscription || this.closing) {
        // A new pairing waits for the previous owner and its cleanup, without
        // inheriting the old subscription's error or cancellation generation.
        await Promise.allSettled([this.initialSubscription, this.closing]);
      }
      const subscribing = (async () => {
        const [, options] = args;
        if (!options?.transportType || options.transportType === 'relay') {
          if (!options?.internal?.skipSubscribe) {
            // Recover the socket without taking ownership of SDK subscriptions.
            this.reconnectWanted ||= !relayer.connected;
          }
          // The subscription's 15s/60s timers must start after socket recovery,
          // so an old subscribe cannot time out and restart a newer retry.
          await this.open(undefined, true);
        }
        return subscribe(...args);
      })();
      this.initialSubscription = subscribing;
      try {
        return await subscribing;
      } finally {
        if (this.initialSubscription === subscribing) {
          this.initialSubscription = undefined;
        }
      }
    };

    const debug = relayer.logger.debug;
    relayer.logger.debug = (...args: unknown[]) => {
      if (
        args.some(
          (arg) =>
            typeof arg === 'string' &&
            /^Connecting to .+, attempt: \d+\.\.\.$/.test(arg),
        )
      ) {
        this.trackConnection();
        this.attemptStarted = true;
      }
      Reflect.apply(debug, relayer.logger, args);
    };
    const warn = relayer.logger.warn;
    relayer.logger.warn = (...args: unknown[]) => {
      if (this.attemptStarted && !relayer.connected) {
        this.attemptStarted = false;
        this.failed = true;
        const tracked = this.trackConnection();
        // Core logs, rather than emits, individual attempt failures.
        // Its timeout does not cancel the underlying WebSocket registration.
        const timedOut = args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.startsWith('Socket stalled when trying to connect'),
        );
        if (!timedOut) {
          tracked?.settle();
        } else if (tracked?.connection.connecting) {
          // Cancel timed-out native handshakes before the SDK creates another
          // provider, so a retired attempt cannot open during a later retry.
          const details = {
            connectionId: tracked.id,
            cycleId: this.activeCycle?.id,
            round: this.activeCycle?.round,
          };
          void this.closeConnection(tracked).then(
            () => this.diagnostic('relay_registration_cancelled', details),
            (error) =>
              this.diagnostic(
                'relay_registration_cancel_failed',
                details,
                error,
              ),
          );
        }
      }
      Reflect.apply(warn, relayer.logger, args);
    };
    relayer.on(RELAYER_EVENTS.connect, () => {
      this.trackConnection()?.settle();
      this.attemptStarted = false;
      this.failed = false;
      for (const tracked of this.connections.values()) {
        if (tracked.registrationSettled && !tracked.connection.connected) {
          tracked.cleanup();
          this.connections.delete(tracked.connection);
        }
      }
    });
  }

  private createCycle() {
    this.cycleNumber += 1;
    const cycle = {
      id: this.cycleNumber,
      round: 0,
      remainingRounds: MAX_RELAY_ROUNDS,
    };
    this.activeCycle = cycle;
    this.diagnostic('relay_cycle_started');
    return cycle;
  }

  private diagnostic(
    event: string,
    details: Partial<IWalletConnectConnectionLog> = {},
    error?: unknown,
  ) {
    this.core.relayer.events.emit('onekey_relay_diagnostic', {
      event,
      relayUrl: this.currentRelayUrl,
      cycleId: this.activeCycle?.id,
      round: this.activeCycle?.round,
      connected: this.core.relayer.connected,
      connecting: this.core.relayer.connecting,
      ...details,
      error,
    });
  }

  private trackConnection() {
    const connection = this.core.relayer.provider?.connection;
    if (!connection) {
      return undefined;
    }
    const existing = this.connections.get(connection);
    if (existing) {
      return existing;
    }
    let settle = () => {};
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const events = ['open', 'close', 'register_error'];
    this.connectionNumber += 1;
    const tracked: IConnection = {
      id: this.connectionNumber,
      connection,
      settled,
      registrationSettled: false,
      settle: () => {
        tracked.registrationSettled = true;
        settle();
      },
      cleanup: () => {
        for (const event of events) {
          connection.off(event, tracked.settle);
        }
      },
    };
    for (const event of events) {
      connection.on(event, tracked.settle);
    }
    this.connections.set(connection, tracked);
    if (connection.connected || !connection.connecting) {
      tracked.settle();
    }
    return tracked;
  }

  private closeConnection(tracked: IConnection) {
    if (!tracked.closing) {
      const closing = tracked.connection.close();
      tracked.closing = closing;
      void closing
        .finally(() => {
          if (tracked.closing === closing) tracked.closing = undefined;
        })
        .catch(() => undefined);
    }
    return tracked.closing;
  }

  private async drainConnections(
    context: IDrainContext,
    deadline = Date.now() + RELAY_DRAIN_TIMEOUT_MS,
  ): Promise<void> {
    if (!this.draining) {
      const draining = this.drain(context);
      this.draining = draining;
      const release = () => {
        if (this.draining === draining) this.draining = undefined;
      };
      // Keep cleaning up late sockets after the caller's bounded wait expires.
      void draining.then(release, release);
    }
    try {
      await createExpiringPromise(
        this.draining,
        Math.max(0, deadline - Date.now()),
        `WalletConnect ${context.operation} timed out during relay cleanup`,
      );
    } catch (error) {
      this.diagnostic(
        'relay_cleanup_failed',
        {
          ...this.drainState,
          elapsedMs: Date.now() - (this.drainStartedAt ?? Date.now()),
        },
        error,
      );
      throw error;
    }
    // A caller can join cleanup left running by an earlier timed-out switch.
    // Drain any provider recovered since that cleanup took its snapshot too.
    if (this.connections.size) await this.drainConnections(context, deadline);
  }

  private async drain(context: IDrainContext) {
    const startedAt = Date.now();
    this.drainStartedAt = startedAt;
    this.trackConnection();
    // Later SDK recovery can create a new provider on the same endpoint. This
    // cleanup owns only the connections retired when it started.
    const connections = Array.from(this.connections.values());
    const phase = (
      cleanupPhase: IWalletConnectConnectionLog['cleanupPhase'],
      tracked?: IConnection,
    ) => {
      this.drainState = {
        ...context,
        cleanupPhase,
        connectionId: tracked?.id,
        pendingConnections: this.connections.size,
        elapsedMs: Date.now() - startedAt,
        connected: tracked?.connection.connected,
        connecting: tracked?.connection.connecting,
      };
      this.diagnostic('relay_cleanup', this.drainState);
    };
    // Relay switching must not disable SDK recovery if the next online check
    // fails before connect() clears transportExplicitlyClosed.
    phase('disconnect_transport');
    await this.disconnectTransport();
    for (const tracked of connections) {
      // The patched transport retires pending registrations and isolates their
      // late callbacks. Cancel first: waiting first can stall forever on native.
      if (
        tracked.closing ||
        tracked.connection.connected ||
        tracked.connection.connecting
      ) {
        phase(
          tracked.connection.connecting
            ? 'cancel_registration'
            : 'close_socket',
          tracked,
        );
        await this.closeConnection(tracked);
      }
      phase('wait_registration', tracked);
      await tracked.settled;
      if (tracked.connection.connected) {
        throw new OneKeyLocalError('WalletConnect transport is still open');
      }
      tracked.cleanup();
      this.connections.delete(tracked.connection);
    }
    phase('complete');
  }

  private async close(operation: IWalletConnectRelayOperation = 'close') {
    this.generation += 1;
    this.switching = true;
    if (!this.closing) {
      const opening = this.opening;
      const subscribing = this.initialSubscription;
      this.closing = (async () => {
        await this.closeTransport();
        await this.drainConnections({ operation });
        if (opening || subscribing) {
          // A provider may still be created after an asynchronous JWT lookup.
          // Wait for its owner to exit, then drain any late-created socket.
          await Promise.allSettled([opening, subscribing]);
          await this.closeTransport();
          await this.drainConnections({ operation });
        }
      })().finally(() => {
        this.closing = undefined;
        this.switching = false;
        this.core.relayer.events.emit('onekey_relay_switch_cancelled', {
          operation,
          relayUrl: this.currentRelayUrl,
        });
      });
    }
    await this.closing;
  }

  private async open(relayUrl?: string, force = false): Promise<void> {
    const { relayer } = this.core;
    // An open overlapping explicit closure belongs to the cancelled cycle.
    // A fresh open/restart after closure can still start the SDK normally.
    if (this.closing) {
      throw new OneKeyLocalError('WalletConnect connection cancelled');
    }
    // Subscription restoration issues RPCs from inside transportOpen. Allow
    // them on the new connected socket without waiting on their own promise.
    if (
      relayer.connected &&
      !this.switching &&
      (!relayUrl || relayUrl === this.currentRelayUrl)
    ) {
      return;
    }
    if (this.opening) {
      return this.opening;
    }
    if (!force && !relayer.subscriber.hasAnyTopics && !this.reconnectWanted) {
      return;
    }
    const generation = this.generation;
    const opening = this.run(generation, this.createCycle(), relayUrl);
    this.opening = opening;
    try {
      await opening;
    } finally {
      if (this.opening === opening) {
        this.opening = undefined;
      }
    }
  }

  private async run(
    generation: number,
    cycle: IConnectionCycle,
    requestedUrl?: string,
  ) {
    let lastError: Error = new OneKeyLocalError(
      'WalletConnect relay did not connect',
    );
    for (let round = 0; cycle.remainingRounds > 0; round += 1) {
      cycle.remainingRounds -= 1;
      cycle.round += 1;
      this.activeCycle = cycle;
      if (generation !== this.generation) {
        throw new OneKeyLocalError('WalletConnect connection cancelled');
      }
      let nextUrl: string | undefined = this.currentRelayUrl;
      if (round === 0 && requestedUrl) {
        nextUrl = WALLET_CONNECT_RELAY_URLS.find((url) => url === requestedUrl);
      } else if (this.failed && !this.draining) {
        nextUrl = WALLET_CONNECT_RELAY_URLS.find(
          (url) => url !== this.currentRelayUrl,
        );
      }
      if (!nextUrl) {
        throw new OneKeyLocalError('WalletConnect relay is unavailable');
      }
      if (nextUrl !== this.currentRelayUrl) {
        this.switching = true;
        const switchDetails = {
          operation: 'switch' as const,
          previousRelayUrl: this.currentRelayUrl,
          relayUrl: this.currentRelayUrl,
          targetRelayUrl: nextUrl,
          cycleId: cycle.id,
          round: cycle.round,
        };
        this.core.relayer.events.emit(
          'onekey_relay_switch_waiting',
          switchDetails,
        );
        try {
          await this.drainConnections({
            operation: 'switch',
            targetRelayUrl: nextUrl,
          });
        } catch (error) {
          // A genuine cleanup failure must still prevent competing transports.
          this.switching = false;
          this.core.relayer.events.emit('onekey_relay_switch_cancelled', {
            ...switchDetails,
            error,
          });
          throw error;
        }
        if (generation !== this.generation) {
          throw new OneKeyLocalError('WalletConnect connection cancelled');
        }
        const previousRelayUrl = this.currentRelayUrl;
        this.currentRelayUrl = nextUrl;
        this.switching = false;
        this.core.relayer.events.emit('onekey_relay_changed', {
          ...switchDetails,
          previousRelayUrl,
          relayUrl: nextUrl,
        });
      }
      this.diagnostic('relay_round_started');
      try {
        await this.connectTransport(nextUrl);
        if (generation !== this.generation) {
          throw new OneKeyLocalError('WalletConnect connection cancelled');
        }
        if (this.core.relayer.connected) {
          this.failed = false;
          this.reconnectWanted = false;
          return;
        }
        throw new OneKeyLocalError('WalletConnect relay did not connect');
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new OneKeyLocalError('WalletConnect relay connection failed');
        this.failed = true;
        // The SDK clears its connection promise in a later microtask.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    this.diagnostic('relay_cycle_exhausted', {}, lastError);
    // Return after two rounds without closing the transport or setting a stop
    // flag. SDK heartbeat and network callbacks may start a fresh cycle.
    throw lastError;
  }
}
