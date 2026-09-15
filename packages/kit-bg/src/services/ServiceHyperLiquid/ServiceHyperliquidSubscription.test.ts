import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsActiveAccountStatusInfoAtom,
} from '../../states/jotai/atoms/perps';

import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@nktkas/hyperliquid', () => ({
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  return {
    ...actual,
    backgroundClass:
      () =>
      <T extends new (...args: never[]) => unknown>(ClassType: T) =>
        ClassType,
    backgroundMethod:
      () =>
      (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
        descriptor,
  };
});

const mockRecordWebSocketConnectResult = jest.fn();
const mockRecordWebSocketClosed = jest.fn();
jest.mock('@onekeyhq/shared/src/request/availabilityMetrics', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityMetrics')
  >('@onekeyhq/shared/src/request/availabilityMetrics'),
  recordWebSocketClosed: (...args: unknown[]) => {
    mockRecordWebSocketClosed(...args);
  },
  recordWebSocketConnectResult: (...args: unknown[]) => {
    mockRecordWebSocketConnectResult(...args);
  },
}));

function createService() {
  return new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  });
}

describe('ServiceHyperliquidSubscription Fast L2 lifecycle', () => {
  it('invalidates delayed recovery when the socket closes', () => {
    const service = createService();
    const internals = service as unknown as {
      _fastL2RecoveryGeneration: number;
    };
    internals._fastL2RecoveryGeneration = 4;

    service.socketCloseHandler({
      target: { readyState: 3 },
    } as unknown as WebSocketEventMap['close']);

    expect(internals._fastL2RecoveryGeneration).toBe(5);
  });

  it('invalidates delayed recovery when the client closes explicitly', async () => {
    const service = createService();
    const internals = service as unknown as {
      _closeClient: () => Promise<void>;
      _fastL2RecoveryGeneration: number;
    };
    internals._fastL2RecoveryGeneration = 4;

    await internals._closeClient();

    expect(internals._fastL2RecoveryGeneration).toBe(5);
  });
});

describe('ServiceHyperliquidSubscription WebSocket availability metrics', () => {
  type IAvailabilityInternals = {
    _client: { dispose: () => Promise<void> } | null;
    _closeClient: () => Promise<void>;
    _startWebSocketAvailabilityAttempt: (
      trigger: 'initial' | 'reconnect',
    ) => void;
    _webSocketAvailabilityAttempt: {
      startedAt: number;
      trigger: 'initial' | 'reconnect';
    } | null;
    _webSocketConnectedAt: number | null;
  };

  const closeEvent = (code: number) =>
    ({
      code,
      target: { readyState: 3 },
    }) as unknown as WebSocketEventMap['close'];

  const setup = () => {
    const service = createService();
    return {
      service,
      internals: service as unknown as IAvailabilityInternals,
    };
  };

  beforeEach(() => {
    mockRecordWebSocketConnectResult.mockClear();
    mockRecordWebSocketClosed.mockClear();
  });

  it('cancels a pending attempt instead of attributing a new result to it', () => {
    const { service, internals } = setup();
    internals._startWebSocketAvailabilityAttempt('reconnect');
    internals._startWebSocketAvailabilityAttempt('initial');

    service.socketErrorHandler({
      target: { readyState: 3 },
    } as unknown as WebSocketEventMap['error']);

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [
        expect.objectContaining({
          status: 'cancelled',
          transport: 'perps',
          trigger: 'reconnect',
        }),
      ],
      [
        expect.objectContaining({
          status: 'failed',
          transport: 'perps',
          trigger: 'initial',
        }),
      ],
    ]);
  });

  it('counts a close while connecting as a connect result, not a closed connection', () => {
    const { service, internals } = setup();
    internals._startWebSocketAvailabilityAttempt('initial');

    service.socketCloseHandler(closeEvent(3008));

    expect(mockRecordWebSocketConnectResult).toHaveBeenCalledTimes(1);
    expect(mockRecordWebSocketConnectResult).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 3008,
        status: 'timeout',
        trigger: 'initial',
      }),
    );
    expect(mockRecordWebSocketClosed).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt?.trigger).toBe('reconnect');
  });

  it('records a dropped open socket as transport_close', () => {
    const { service, internals } = setup();
    internals._webSocketConnectedAt = Date.now();

    service.socketCloseHandler(closeEvent(1006));

    expect(mockRecordWebSocketClosed.mock.calls).toEqual([
      [{ transport: 'perps', reason: 'transport_close' }],
    ]);
    expect(mockRecordWebSocketConnectResult).not.toHaveBeenCalled();
  });

  it('records a client disconnect when an open client is closed explicitly', async () => {
    const { internals } = setup();
    internals._webSocketConnectedAt = Date.now();
    // An OPEN socket's close arrives after dispose removed our listeners.
    internals._client = { dispose: jest.fn(() => Promise.resolve()) };

    await internals._closeClient();

    expect(mockRecordWebSocketClosed.mock.calls).toEqual([
      [{ transport: 'perps', reason: 'client_disconnect' }],
    ]);
    expect(mockRecordWebSocketConnectResult).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });

  it('cancels a connecting client once, even when close is dispatched during dispose', async () => {
    const { service, internals } = setup();
    internals._startWebSocketAvailabilityAttempt('initial');
    // Closing a CONNECTING socket dispatches close synchronously.
    internals._client = {
      dispose: jest.fn(() => {
        service.socketCloseHandler(closeEvent(1006));
        return Promise.resolve();
      }),
    };

    await internals._closeClient();

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [expect.objectContaining({ status: 'cancelled', trigger: 'initial' })],
    ]);
    expect(mockRecordWebSocketClosed).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });
});

describe('ServiceHyperliquidSubscription WebSocket availability over the perps client lifecycle', () => {
  type ISocketListener = (event: { code?: number; target: unknown }) => unknown;
  type IClientInternals = {
    _closeClient: () => Promise<void>;
    _startPingLoop: () => void;
    _watchSubscriptionAtoms: () => void;
    _webSocketAvailabilityAttempt: {
      startedAt: number;
      trigger: 'initial' | 'reconnect';
    } | null;
    getWebSocketClient: () => Promise<unknown>;
  };

  let now = 0;
  let definedWebSocketGlobal = false;

  // Stands in for the reconnecting socket behind WebSocketTransport; its
  // listeners are the real handlers the service registers on client creation.
  const createFakeSocket = () => {
    const listeners = new Map<string, Set<ISocketListener>>();
    const socket = {
      readyState: 0,
      addEventListener: (type: string, listener: ISocketListener) => {
        const typeListeners = listeners.get(type) ?? new Set<ISocketListener>();
        typeListeners.add(listener);
        listeners.set(type, typeListeners);
      },
      removeEventListener: (type: string, listener: ISocketListener) => {
        listeners.get(type)?.delete(listener);
      },
      close: jest.fn<void, []>(),
    };
    const dispatch = (
      type: 'close' | 'open',
      { code, readyState }: { code?: number; readyState: number },
    ) => {
      socket.readyState = readyState;
      [...(listeners.get(type) ?? [])].forEach((listener) => {
        listener({ code, target: socket });
      });
    };
    return { dispatch, socket };
  };

  const flushAsyncWork = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

  const setupClient = async () => {
    const service = createService();
    const internals = service as unknown as IClientInternals;
    jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    jest.spyOn(internals, '_startPingLoop').mockImplementation(() => {});
    jest.spyOn(service, 'updateSubscriptions').mockResolvedValue(undefined);
    const fake = createFakeSocket();
    jest.mocked(WebSocketTransport).mockImplementation(
      () =>
        ({
          socket: fake.socket,
          _hlEvents: {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
          },
          _postRequest: { request: jest.fn() },
        }) as unknown as WebSocketTransport,
    );
    jest
      .mocked(SubscriptionClient)
      .mockImplementation(() => ({}) as unknown as SubscriptionClient);

    await internals.getWebSocketClient();

    const reconnectionDelay =
      jest.mocked(WebSocketTransport).mock.calls[0]?.[0]?.reconnect
        ?.reconnectionDelay;
    if (typeof reconnectionDelay !== 'function') {
      throw new OneKeyLocalError(
        'Perps transport must compute its reconnect delay',
      );
    }
    return { fake, internals, reconnectionDelay };
  };

  const openSocket = async (fake: ReturnType<typeof createFakeSocket>) => {
    fake.dispatch('open', { readyState: 1 });
    await flushAsyncWork();
  };

  beforeAll(() => {
    const g = globalThis as { WebSocket?: unknown };
    if (typeof g.WebSocket === 'undefined') {
      g.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
      definedWebSocketGlobal = true;
    }
  });

  afterAll(() => {
    if (definedWebSocketGlobal) {
      delete (globalThis as { WebSocket?: unknown }).WebSocket;
    }
  });

  beforeEach(() => {
    now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockRecordWebSocketConnectResult.mockClear();
    mockRecordWebSocketClosed.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(WebSocketTransport).mockReset();
    jest.mocked(SubscriptionClient).mockReset();
  });

  it('reports the initial attempt started with the client as ok on open', async () => {
    const { fake, internals } = await setupClient();
    expect(internals._webSocketAvailabilityAttempt).toEqual({
      startedAt: 1000,
      trigger: 'initial',
    });
    expect(mockRecordWebSocketConnectResult).not.toHaveBeenCalled();

    now = 1250;
    await openSocket(fake);

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [
        {
          durationMs: 250,
          status: 'ok',
          transport: 'perps',
          trigger: 'initial',
        },
      ],
    ]);
    expect(mockRecordWebSocketClosed).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });

  it('keeps the backoff schedule and leaves a non-reconnect attempt untouched', async () => {
    const { fake, reconnectionDelay } = await setupClient();

    expect(
      [0, 1, 3, 5, 6, 20].map((attempt) => reconnectionDelay(attempt)),
    ).toEqual([150, 300, 1200, 4800, 8000, 8000]);

    now = 1400;
    await openSocket(fake);

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [expect.objectContaining({ durationMs: 400, trigger: 'initial' })],
    ]);
  });

  it('excludes the reconnect backoff from reconnect connect durations', async () => {
    const { fake, internals, reconnectionDelay } = await setupClient();
    await openSocket(fake);
    mockRecordWebSocketConnectResult.mockClear();

    now = 60_000;
    fake.dispatch('close', { code: 1006, readyState: 3 });
    expect(mockRecordWebSocketClosed.mock.calls).toEqual([
      [{ reason: 'transport_close', transport: 'perps' }],
    ]);
    expect(internals._webSocketAvailabilityAttempt).toEqual({
      startedAt: 60_000,
      trigger: 'reconnect',
    });

    // First retry sleeps 150ms, then the new socket times out after 5s.
    expect(reconnectionDelay(0)).toBe(150);
    now = 60_000 + 150 + 5000;
    fake.dispatch('close', { code: 3008, readyState: 3 });

    // Second retry sleeps 300ms, then the new socket opens after 250ms.
    expect(reconnectionDelay(1)).toBe(300);
    now += 300 + 250;
    await openSocket(fake);

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [
        {
          durationMs: 5000,
          errorCode: 3008,
          status: 'timeout',
          transport: 'perps',
          trigger: 'reconnect',
        },
      ],
      [
        {
          durationMs: 250,
          status: 'ok',
          transport: 'perps',
          trigger: 'reconnect',
        },
      ],
    ]);
    expect(mockRecordWebSocketClosed).toHaveBeenCalledTimes(1);
  });

  it('records one client disconnect when an open client is closed', async () => {
    const { fake, internals } = await setupClient();
    await openSocket(fake);
    mockRecordWebSocketConnectResult.mockClear();
    // Worst case for double counting: close reaches our listener while
    // dispose is still running.
    fake.socket.close.mockImplementation(() => {
      fake.dispatch('close', { code: 1000, readyState: 3 });
    });

    await internals._closeClient();

    expect(fake.socket.close).toHaveBeenCalledTimes(1);
    expect(mockRecordWebSocketClosed.mock.calls).toEqual([
      [{ reason: 'client_disconnect', transport: 'perps' }],
    ]);
    expect(mockRecordWebSocketConnectResult).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });

  it('cancels the in-flight initial attempt once when a connecting client is closed', async () => {
    const { fake, internals } = await setupClient();
    // Closing a CONNECTING socket dispatches close synchronously.
    fake.socket.close.mockImplementation(() => {
      fake.dispatch('close', { code: 1006, readyState: 3 });
    });

    now = 1400;
    await internals._closeClient();

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [
        {
          durationMs: 400,
          status: 'cancelled',
          transport: 'perps',
          trigger: 'initial',
        },
      ],
    ]);
    expect(mockRecordWebSocketClosed).not.toHaveBeenCalled();
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });

  it('cancels a reconnect attempt still in backoff with a zero duration', async () => {
    const { fake, internals, reconnectionDelay } = await setupClient();
    await openSocket(fake);
    mockRecordWebSocketConnectResult.mockClear();

    now = 60_000;
    fake.dispatch('close', { code: 1006, readyState: 3 });
    expect(reconnectionDelay(5)).toBe(4800);

    now = 61_000;
    await internals._closeClient();

    expect(mockRecordWebSocketConnectResult.mock.calls).toEqual([
      [
        {
          durationMs: 0,
          status: 'cancelled',
          transport: 'perps',
          trigger: 'reconnect',
        },
      ],
    ]);
    expect(mockRecordWebSocketClosed.mock.calls).toEqual([
      [{ reason: 'transport_close', transport: 'perps' }],
    ]);
    expect(internals._webSocketAvailabilityAttempt).toBeNull();
  });
});

describe('ServiceHyperliquidSubscription resume stream liveness', () => {
  type IResumeInternals = {
    _lastMessageAt: number | null;
    _lastFrameAt: number | null;
    _socketOpenedAt: number | null;
    _forceReconnectTransport: () => Promise<void>;
    _reconcileOpenSocketSubscriptionsOnResume: (p?: unknown) => Promise<void>;
    _watchSubscriptionAtoms: () => void;
    getWebSocketClient: () => Promise<unknown>;
  };

  const setupOpenSocketService = () => {
    const service = createService();
    const internals = service as unknown as IResumeInternals;
    jest
      .spyOn(internals, 'getWebSocketClient')
      .mockResolvedValue({ transport: { socket: { readyState: 1 } } });
    const force = jest
      .spyOn(internals, '_forceReconnectTransport')
      .mockResolvedValue(undefined);
    const reconcile = jest
      .spyOn(internals, '_reconcileOpenSocketSubscriptionsOnResume')
      .mockResolvedValue(undefined);
    jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    return { service, internals, force, reconcile };
  };

  beforeAll(() => {
    const g = globalThis as { WebSocket?: unknown };
    if (typeof g.WebSocket === 'undefined') {
      g.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
    }
  });

  it('forces a reconnect when the open socket stream went stale', async () => {
    const { service, internals, force, reconcile } = setupOpenSocketService();
    internals._lastMessageAt = Date.now() - 60_000;
    internals._socketOpenedAt = Date.now() - 60_000;

    await service.resumeSubscriptions();

    expect(force).toHaveBeenCalledTimes(1);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('reuses the open socket while the stream is fresh', async () => {
    const { service, internals, force, reconcile } = setupOpenSocketService();
    internals._lastFrameAt = Date.now() - 1000;

    await service.resumeSubscriptions();

    expect(force).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('keeps the legacy reuse when no liveness evidence exists', async () => {
    const { service, internals, force, reconcile } = setupOpenSocketService();
    internals._lastMessageAt = null;
    internals._socketOpenedAt = null;

    await service.resumeSubscriptions();

    expect(force).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('keeps trusting the socket when frames arrived while the handler was disabled', async () => {
    const { service, internals, force, reconcile } = setupOpenSocketService();
    internals._lastMessageAt = Date.now() - 60_000;
    internals._socketOpenedAt = Date.now() - 60_000;
    await service.disableSubscriptionsHandler();
    await (
      service as unknown as {
        _handleSubscriptionData: (
          t: ESubscriptionType,
          e: CustomEvent,
        ) => Promise<void>;
      }
    )._handleSubscriptionData(ESubscriptionType.ALL_MIDS, {
      detail: {},
    } as unknown as CustomEvent);

    await service.resumeSubscriptions();

    expect(force).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent stale-stream reconnects into one transport rebuild', async () => {
    const { service, internals, force } = setupOpenSocketService();
    let release: (() => void) | undefined;
    force.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    internals._lastMessageAt = Date.now() - 60_000;
    internals._socketOpenedAt = Date.now() - 60_000;

    const first = service.resumeSubscriptions();
    const second = service.resumeSubscriptions();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    release?.();
    await Promise.all([first, second]);

    expect(force).toHaveBeenCalledTimes(1);
  });

  it('trusts a freshly opened socket that has not received messages yet', async () => {
    const { service, internals, force, reconcile } = setupOpenSocketService();
    internals._lastMessageAt = Date.now() - 60_000;
    internals._socketOpenedAt = Date.now() - 1000;

    await service.resumeSubscriptions();

    expect(force).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHyperliquidSubscription liveness recovery', () => {
  it('rejects a proof older than the latest disable', async () => {
    const service = createService();
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();
    await service.disableSubscriptionsHandler();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(false);
    expect(service.subscriptionsHandlerDisabled).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('announces a successful recovery on the event bus', async () => {
    const service = createService();
    const internals = service as unknown as {
      _watchSubscriptionAtoms: () => void;
    };
    jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    jest.spyOn(service, 'updateSubscriptions').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    try {
      await service.disableSubscriptionsHandler();
      const proofCount = await service.getSubscriptionsHandlerDisabledCount();

      await expect(
        service.recoverSubscriptionsAfterLivenessProof({
          disabledCount: proofCount,
        }),
      ).resolves.toBe(true);
      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.PerpsSubscriptionsRecovered,
        undefined,
      );
    } finally {
      emit.mockRestore();
    }
  });

  it('does not announce a rejected recovery', async () => {
    const service = createService();
    jest.spyOn(service, 'updateSubscriptions').mockResolvedValue(undefined);
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    try {
      await service.disableSubscriptionsHandler();
      const proofCount = await service.getSubscriptionsHandlerDisabledCount();
      await service.disableSubscriptionsHandler();

      await expect(
        service.recoverSubscriptionsAfterLivenessProof({
          disabledCount: proofCount,
        }),
      ).resolves.toBe(false);
      expect(emit).not.toHaveBeenCalledWith(
        EAppEventBusNames.PerpsSubscriptionsRecovered,
        undefined,
      );
    } finally {
      emit.mockRestore();
    }
  });

  it('reinstalls the atom watcher before reconciling on a successful recovery', async () => {
    const service = createService();
    const internals = service as unknown as {
      _watchSubscriptionAtoms: () => void;
    };
    const watch = jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(true);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0],
    );
  });

  it('does not touch the atom watcher when the proof is stale', async () => {
    const service = createService();
    const internals = service as unknown as {
      _watchSubscriptionAtoms: () => void;
    };
    const watch = jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    jest.spyOn(service, 'updateSubscriptions').mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();
    await service.disableSubscriptionsHandler();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(false);
    expect(watch).not.toHaveBeenCalled();
  });

  it('enables and reconciles when the proof matches the latest generation', async () => {
    const service = createService();
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await service.disableSubscriptionsHandler();
    const proofCount = await service.getSubscriptionsHandlerDisabledCount();

    await expect(
      service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: proofCount,
      }),
    ).resolves.toBe(true);
    expect(service.subscriptionsHandlerDisabled).toBe(false);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('ServiceHyperliquidSubscription public trades', () => {
  const unsubscribe = jest.fn<Promise<void>, []>();
  const close = jest.fn<Promise<void>, []>();
  const trades = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe.mockResolvedValue(undefined);
    close.mockResolvedValue(undefined);
    trades.mockResolvedValue({ unsubscribe });
    jest.mocked(WebSocketTransport).mockImplementation(
      () =>
        ({
          close,
        }) as unknown as WebSocketTransport,
    );
    jest.mocked(SubscriptionClient).mockImplementation(
      () =>
        ({
          trades,
        }) as unknown as SubscriptionClient,
    );
  });

  it('shares one subscription until the last consumer unsubscribes', async () => {
    const service = createService();

    await service.subscribePublicTrades({ coin: 'BTC' });
    await service.subscribePublicTrades({ coin: 'BTC' });

    expect(WebSocketTransport).toHaveBeenCalledTimes(1);
    expect(trades).toHaveBeenCalledTimes(1);

    await service.unsubscribePublicTrades({ coin: 'BTC' });
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    await service.unsubscribePublicTrades({ coin: 'BTC' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('batches typed Hyperliquid trade updates before foreground delivery', async () => {
    jest.useFakeTimers();
    const service = createService();
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    const olderTrade = {
      coin: 'BTC',
      px: '64000',
      time: 1_700_000_000_123,
    } as IRecentTrade;
    const newerTrade = {
      coin: 'BTC',
      px: '64001',
      time: 1_700_000_000_987,
    } as IRecentTrade;

    try {
      await service.subscribePublicTrades({ coin: 'BTC' });
      const listener = trades.mock.calls[0][1] as (
        data: IRecentTrade[],
      ) => void;
      listener([olderTrade]);
      listener([newerTrade]);

      expect(emit).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1000);

      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.HyperliquidDataUpdate,
        {
          type: 'market',
          subType: ESubscriptionType.TRADES,
          data: [newerTrade, olderTrade],
        },
      );
    } finally {
      emit.mockRestore();
      await service.unsubscribePublicTrades({ coin: 'BTC' });
      jest.useRealTimers();
    }
  });
});

describe('ServiceHyperliquidSubscription funded activation refresh', () => {
  const accountAddress = '0xabc' as const;
  let activatedOk = false;

  beforeEach(() => {
    activatedOk = false;
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
      accountId: 'account-1',
      indexedAccountId: 'indexed-account-1',
      accountAddress,
      deriveType: 'default',
      walletType: 'hd',
    });
    jest
      .spyOn(perpsActiveAccountStatusInfoAtom, 'get')
      .mockImplementation(async () => ({
        accountAddress,
        details: {
          activatedOk,
          agentOk: false,
          referralCodeOk: false,
          builderFeeOk: false,
          internalRebateBoundOk: false,
          abstractionOk: false,
        },
      }));
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries a funded refresh after another status check was busy', async () => {
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(async () => {
        activatedOk = true;
      });
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
          waitForPerpsAccountStatusCheckIdle: jest
            .fn()
            .mockResolvedValue(undefined),
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
      _fundedActivationRefreshPendingAddress: string | null;
      _fundedActivationConfirmedAddress: string | null;
    };

    await internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    expect(startStatusCheck).toHaveBeenCalledTimes(1);
    expect(startStatusCheck).toHaveBeenCalledWith({
      preserveFundedBalances: true,
    });
    expect(internals._fundedActivationRefreshPendingAddress).toBe(
      accountAddress,
    );

    await jest.advanceTimersByTimeAsync(250);

    expect(startStatusCheck).toHaveBeenCalledTimes(2);
    expect(internals._fundedActivationRefreshPendingAddress).toBeNull();
    expect(internals._fundedActivationConfirmedAddress).toBe(accountAddress);
  });

  it('does not consume activation attempts while another status check is busy', async () => {
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(async () => {
        activatedOk = true;
      });
    let releaseBusyCheck: (() => void) | undefined;
    const waitForIdle = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseBusyCheck = resolve;
        }),
    );
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
          waitForPerpsAccountStatusCheckIdle: waitForIdle,
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
      _fundedActivationConfirmedAddress: string | null;
    };

    const refreshPromise = internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    await jest.advanceTimersByTimeAsync(1500);

    expect(startStatusCheck).toHaveBeenCalledTimes(1);
    expect(waitForIdle).toHaveBeenCalledTimes(1);

    releaseBusyCheck?.();
    await refreshPromise;
    await jest.advanceTimersByTimeAsync(250);

    expect(startStatusCheck).toHaveBeenCalledTimes(2);
    expect(internals._fundedActivationConfirmedAddress).toBe(accountAddress);
  });

  it('preserves a newer account retry when a busy wait becomes stale', async () => {
    const nextAccountAddress = '0xdef';
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockReturnValue(undefined);
    let releaseBusyCheck: (() => void) | undefined;
    const waitForIdle = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseBusyCheck = resolve;
        }),
    );
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
          waitForPerpsAccountStatusCheckIdle: waitForIdle,
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
      _resetFundedActivationRefreshState: () => void;
      _scheduleFundedActivationRefreshRetry: (params: {
        address: string;
        delayMs: number;
        refreshAttempt: number;
      }) => void;
      _fundedActivationRefreshInFlightAddress: string | null;
      _fundedActivationRefreshPendingAddress: string | null;
      _fundedActivationRefreshRetryTimer: ReturnType<typeof setTimeout> | null;
    };

    const staleRefreshPromise = internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(waitForIdle).toHaveBeenCalledTimes(1);

    internals._resetFundedActivationRefreshState();
    internals._scheduleFundedActivationRefreshRetry({
      address: nextAccountAddress,
      delayMs: 500,
      refreshAttempt: 1,
    });
    const nextAccountRetryTimer = internals._fundedActivationRefreshRetryTimer;

    releaseBusyCheck?.();
    await staleRefreshPromise;

    expect(internals._fundedActivationRefreshInFlightAddress).toBeNull();
    expect(internals._fundedActivationRefreshPendingAddress).toBe(
      nextAccountAddress,
    );
    expect(internals._fundedActivationRefreshRetryTimer).toBe(
      nextAccountRetryTimer,
    );
  });

  it('retries after the cooldown while activation remains unconfirmed', async () => {
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        activatedOk = true;
      });
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
      _fundedActivationRefreshPendingAddress: string | null;
    };

    await internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    expect(startStatusCheck).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(9999);
    expect(startStatusCheck).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(startStatusCheck).toHaveBeenCalledTimes(2);
    expect(internals._fundedActivationRefreshPendingAddress).toBeNull();
  });

  it('stops automatic retries after six unconfirmed attempts', async () => {
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockResolvedValue(undefined);
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
      _fundedActivationRefreshPendingAddress: string | null;
      _fundedActivationRefreshRetryTimer: ReturnType<typeof setTimeout> | null;
    };

    await internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    await jest.advanceTimersByTimeAsync(50_000);

    expect(startStatusCheck).toHaveBeenCalledTimes(6);
    expect(internals._fundedActivationRefreshPendingAddress).toBeNull();
    expect(internals._fundedActivationRefreshRetryTimer).toBeNull();

    await jest.advanceTimersByTimeAsync(60_000);
    expect(startStatusCheck).toHaveBeenCalledTimes(6);
  });

  it('waits for a new funded event after a status check fails', async () => {
    const startStatusCheck = jest
      .fn<Promise<void> | undefined, []>()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockImplementationOnce(async () => {
        activatedOk = true;
      });
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: {
          startPerpsAccountStatusCheckIfIdle: startStatusCheck,
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as {
      _refreshActivationFromFundedState: (params: {
        eventAddress: string;
        hasFundedBalance: boolean;
      }) => Promise<void>;
    };

    await internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(startStatusCheck).toHaveBeenCalledTimes(1);

    await internals._refreshActivationFromFundedState({
      eventAddress: accountAddress,
      hasFundedBalance: true,
    });

    expect(startStatusCheck).toHaveBeenCalledTimes(2);
  });
});
