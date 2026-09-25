import { RELAYER_EVENTS, Relayer } from '@walletconnect/core';
import { createExpiringPromise } from '@walletconnect/utils';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  WALLET_CONNECT_RELAY_URL,
  WALLET_CONNECT_RELAY_URLS,
} from '@onekeyhq/shared/src/walletConnect/constant';

import type { IJsonRpcConnection } from '@walletconnect/jsonrpc-utils';
import type { ICore } from '@walletconnect/types';

// Core 2.21.9 makes up to five attempts per round. Limit only this invocation's
// added fallback work; later SDK reconnect triggers receive a fresh budget.
const MAX_RELAY_ROUNDS = 2;
const RELAY_DRAIN_TIMEOUT_MS = 15_000;

type IConnectionCycle = { remainingRounds: number };

type IConnection = {
  connection: IJsonRpcConnection;
  settled: Promise<void>;
  registrationSettled: boolean;
  settle: () => void;
  cleanup: () => void;
};

// Serialize public SDK operations around relay changes. A complete SDK retry
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

  private failed = false;

  private attemptStarted = false;

  private switching = false;

  private initialSubscription?: Promise<string>;

  private initialSubscriptionCycle?: IConnectionCycle;

  private connections = new Map<IJsonRpcConnection, IConnection>();

  private readonly openTransport: ICore['relayer']['transportOpen'];

  private readonly closeTransport: ICore['relayer']['transportClose'];

  private readonly disconnectTransport: Relayer['transportDisconnect'];

  private constructor(
    private readonly core: ICore,
    initialRelayUrl = WALLET_CONNECT_RELAY_URL,
  ) {
    this.currentRelayUrl = initialRelayUrl;
    const { relayer } = core;
    this.openTransport = relayer.transportOpen.bind(relayer);
    this.closeTransport = relayer.transportClose.bind(relayer);
    const request = relayer.request.bind(relayer);
    const subscribe = relayer.subscribe.bind(relayer);
    if (!(relayer instanceof Relayer)) {
      throw new OneKeyLocalError('Expected the WalletConnect SDK relayer');
    }
    this.disconnectTransport = relayer.transportDisconnect.bind(relayer);

    relayer.transportOpen = (url) => this.open(url);
    relayer.transportClose = () => this.close();
    relayer.restartTransport = async (url) => {
      const opening = this.opening;
      await this.close();
      await opening?.catch(() => undefined);
      await this.open(url ?? this.currentRelayUrl);
    };
    relayer.request = async (...args) => {
      if (this.closing) {
        throw new OneKeyLocalError('WalletConnect connection cancelled');
      }
      if (!relayer.subscriber.hasAnyTopics && !relayer.connected) {
        await this.initialSubscription;
      }
      await this.open();
      // Never replay an RPC after it has been handed to the SDK.
      return request(...args);
    };
    relayer.subscribe = async (...args) => {
      while (this.initialSubscription) {
        await this.initialSubscription;
      }
      // The first pairing has no subscription topics yet. Its SDK subscribe
      // creates the pending topic before reaching the guarded request above.
      if (relayer.subscriber.hasAnyTopics || this.opening || this.closing) {
        await this.open();
      }
      if (!relayer.subscriber.hasAnyTopics && !relayer.connected) {
        // The first subscribe calls the SDK's own connect before its guarded
        // request. Reserve that round so fallback adds at most five attempts.
        this.initialSubscriptionCycle = {
          remainingRounds: MAX_RELAY_ROUNDS - 1,
        };
        const subscribing = subscribe(...args);
        this.initialSubscription = subscribing;
        try {
          return await subscribing;
        } finally {
          this.initialSubscription = undefined;
          this.initialSubscriptionCycle = undefined;
        }
      }
      return subscribe(...args);
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
        // Core 2.21.9 logs, rather than emits, individual attempt failures.
        // Its timeout does not cancel the underlying WebSocket registration.
        const timedOut = args.some(
          (arg) =>
            typeof arg === 'string' &&
            arg.startsWith('Socket stalled when trying to connect'),
        );
        if (!timedOut) {
          tracked?.settle();
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
    const tracked: IConnection = {
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

  private async drainConnections(
    deadline = Date.now() + RELAY_DRAIN_TIMEOUT_MS,
  ): Promise<void> {
    if (!this.draining) {
      const draining = this.drain();
      this.draining = draining;
      const release = () => {
        if (this.draining === draining) this.draining = undefined;
      };
      // Keep cleaning up late sockets after the caller's bounded wait expires.
      void draining.then(release, release);
    }
    await createExpiringPromise(
      this.draining,
      Math.max(0, deadline - Date.now()),
      'WalletConnect relay switch timed out waiting for old sockets to close',
    );
    // A caller can join cleanup left running by an earlier timed-out switch.
    // Drain any provider recovered since that cleanup took its snapshot too.
    if (this.connections.size) await this.drainConnections(deadline);
  }

  private async drain() {
    this.trackConnection();
    // Later SDK recovery can create a new provider on the same endpoint. This
    // cleanup owns only the connections retired when it started.
    const connections = Array.from(this.connections.values());
    // Relay switching must not disable SDK recovery if the next online check
    // fails before connect() clears transportExplicitlyClosed.
    await this.disconnectTransport();
    for (const tracked of connections) {
      // A timed-out registration can still open later. Keep the next relay
      // blocked until it settles and any resulting socket confirms closure.
      await tracked.settled;
      if (tracked.connection.connected) {
        await tracked.connection.close();
      }
      if (tracked.connection.connected) {
        throw new OneKeyLocalError('WalletConnect transport is still open');
      }
      tracked.cleanup();
      this.connections.delete(tracked.connection);
    }
  }

  private async close() {
    this.generation += 1;
    this.switching = true;
    if (!this.closing) {
      const opening = this.opening;
      const subscribing = this.initialSubscription;
      this.closing = (async () => {
        await this.closeTransport();
        await this.drainConnections();
        if (opening || subscribing) {
          // A provider may still be created after an asynchronous JWT lookup.
          // Wait for its owner to exit, then drain any late-created socket.
          await Promise.allSettled([opening, subscribing]);
          await this.closeTransport();
          await this.drainConnections();
        }
      })().finally(() => {
        this.closing = undefined;
        this.switching = false;
        this.core.relayer.events.emit('onekey_relay_switch_cancelled');
      });
    }
    await this.closing;
  }

  private async open(relayUrl?: string): Promise<void> {
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
    if (!relayer.subscriber.hasAnyTopics) {
      return;
    }
    const generation = this.generation;
    const opening = this.run(
      generation,
      this.initialSubscriptionCycle ?? {
        remainingRounds: MAX_RELAY_ROUNDS,
      },
      relayUrl,
    );
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
        this.core.relayer.events.emit('onekey_relay_switch_waiting');
        try {
          await this.drainConnections();
        } catch (error) {
          // The SDK cannot cancel an unopened WebSocket through its public
          // connection API. End this fallback, retaining same-relay recovery
          // until the old registration settles; never open a competing relay.
          this.switching = false;
          this.failed = false;
          this.core.relayer.events.emit('onekey_relay_switch_cancelled');
          throw error;
        }
        if (generation !== this.generation) {
          throw new OneKeyLocalError('WalletConnect connection cancelled');
        }
        const previousRelayUrl = this.currentRelayUrl;
        this.currentRelayUrl = nextUrl;
        this.switching = false;
        this.core.relayer.events.emit('onekey_relay_changed', {
          previousRelayUrl,
          relayUrl: nextUrl,
        });
      }
      try {
        await this.openTransport(nextUrl);
        if (generation !== this.generation) {
          throw new OneKeyLocalError('WalletConnect connection cancelled');
        }
        if (this.core.relayer.connected) {
          this.failed = false;
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
    // Return after two rounds without closing the transport or setting a stop
    // flag. SDK heartbeat and network callbacks may start a fresh cycle.
    throw lastError;
  }
}
