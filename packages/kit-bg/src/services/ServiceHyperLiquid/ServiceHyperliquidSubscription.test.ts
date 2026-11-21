import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IFill,
  IRecentTrade,
  IUserFillsByTimeParameters,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsLiquidationRiskInputsAtom,
  perpsNetworkStatusAtom,
  perpsTradesHistoryDataAtom,
  perpsTradesHistoryRefreshHookAtom,
} from '../../states/jotai/atoms/perps';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import { generateSubscriptionKey } from './utils/SubscriptionConfig';

import type {
  ISubscriptionSpec,
  ISubscriptionState,
} from './utils/SubscriptionConfig';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@nktkas/hyperliquid', () => ({
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('./utils/fundingHistory', () => ({}));
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

function createService() {
  return new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  });
}

describe('ServiceHyperliquidSubscription Fast L2 lifecycle', () => {
  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
  });
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

describe('ServiceHyperliquidSubscription BBO lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([1, 0])('dedupes BBO recovery: socket=%s', async (readyState) => {
    const service = createService();
    const client = { transport: { socket: { readyState, retryCount: 0 } } };
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(false);
    const spec: ISubscriptionSpec<ESubscriptionType.BBO> = {
      key: 'bbo:ETH',
      type: ESubscriptionType.BBO,
      params: { coin: 'ETH' },
      priority: 2,
    };
    service.allSubSpecsMap = {
      [spec.key]: spec,
      allMids: {
        key: 'allMids',
        type: ESubscriptionType.ALL_MIDS,
        params: {},
        priority: 2,
      },
    };
    const internals = service as unknown as {
      _client: typeof client;
      getWebSocketClient: () => Promise<typeof client>;
      _updateSubscriptionsCore: () => Promise<void>;
      _markNetworkStatusSocketOpen: () => Promise<void>;
      _startPingLoop: () => void;
      _resumeRecoveryPromise: Promise<boolean> | null;
      _subscriptionUpdateRecoveryPromise: Promise<void> | null;
      _destroySubscription: (
        s: ISubscriptionSpec<ESubscriptionType>,
      ) => Promise<boolean>;
      _watchSubscriptionAtoms: () => void;
    };
    internals._client = client;
    jest.spyOn(internals, 'getWebSocketClient').mockResolvedValue(client);
    jest
      .spyOn(internals, '_markNetworkStatusSocketOpen')
      .mockResolvedValue(undefined);
    jest.spyOn(internals, '_startPingLoop').mockImplementation(() => {});
    jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    const destroy = jest
      .spyOn(internals, '_destroySubscription')
      .mockResolvedValue(true);
    jest
      .spyOn(service, 'buildRequiredSubscriptionsMap')
      .mockResolvedValue(undefined);
    const reconcile = jest
      .spyOn(internals, '_updateSubscriptionsCore')
      .mockImplementation(async () => {
        expect(destroy).toHaveBeenCalledWith(spec);
      });
    await service.disableSubscriptionsHandler();
    expect(emit).toHaveBeenCalledWith(
      EAppEventBusNames.HyperliquidDataUpdate,
      expect.objectContaining({ subType: ESubscriptionType.BBO, data: null }),
    );
    const disabledCount = await service.getSubscriptionsHandlerDisabledCount();
    setTimeout(() => {
      client.transport.socket.readyState = WebSocket.OPEN;
    }, 10);
    let results: boolean[] | undefined;
    const recovery = Promise.all([
      service.recoverSubscriptionsAfterLivenessProof({ disabledCount }),
      service.recoverSubscriptionsAfterLivenessProof({ disabledCount }),
    ]).then((value) => {
      results = value;
    });
    await jest.advanceTimersByTimeAsync(500);
    expect(results).toEqual([true, true]);
    await recovery;
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(internals._resumeRecoveryPromise).toBeNull();
    expect(internals._subscriptionUpdateRecoveryPromise).toBeNull();
  });
});

describe('ServiceHyperliquidSubscription ping measurement', () => {
  it('cancels the old measurement and measures immediately on the same reconnected client', async () => {
    const service = createService();
    const internals = service as unknown as {
      _client: { ping: (signal: AbortSignal) => Promise<void> };
      _measurePing: () => Promise<void>;
      _stopPingLoop: () => void;
    };
    const complete: (() => void)[] = [];
    const signals: AbortSignal[] = [];
    const ping = jest.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<void>((resolve) => complete.push(resolve));
    });
    const publish = jest
      .spyOn(perpsNetworkStatusAtom, 'set')
      .mockResolvedValue(undefined);
    try {
      internals._client = { ping };
      const oldMeasurement = internals._measurePing();
      await internals._measurePing();
      expect(ping).toHaveBeenCalledTimes(1);
      internals._stopPingLoop();
      expect(signals[0].aborted).toBe(true);
      const newMeasurement = internals._measurePing();
      expect(ping).toHaveBeenCalledTimes(2);
      complete[0]();
      await oldMeasurement;
      expect(publish).not.toHaveBeenCalled();
      await internals._measurePing();
      expect(ping).toHaveBeenCalledTimes(2);
      complete[1]();
      await newMeasurement;
      expect(publish).toHaveBeenCalledTimes(1);
    } finally {
      publish.mockRestore();
    }
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

  it.each([0, 1, 3])(
    'resumes a CONNECTING socket with retryCount=%s',
    async (retryCount) => {
      const { service, internals, force, reconcile } = setupOpenSocketService();
      jest.spyOn(internals, 'getWebSocketClient').mockResolvedValue({
        transport: { socket: { readyState: WebSocket.CONNECTING, retryCount } },
      });

      await service.resumeSubscriptions();

      expect(force).toHaveBeenCalledTimes(retryCount > 0 ? 1 : 0);
      expect(reconcile).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'recovers only the current retrying socket: replaced=%s',
    async (replaced) => {
      const { service, force, reconcile } = setupOpenSocketService();
      const internals = service as unknown as {
        _client: unknown;
        _recoverNotOpenSocketBeforeSubscriptionUpdate: (params: {
          client: unknown;
          reason: string;
        }) => Promise<void>;
        _waitForOpenSocket: () => Promise<boolean>;
      };
      const client = {
        transport: {
          socket: { readyState: WebSocket.CONNECTING, retryCount: 1 },
        },
      };
      const currentClient = replaced
        ? {
            transport: {
              socket: { readyState: WebSocket.OPEN, retryCount: 0 },
            },
          }
        : client;
      internals._client = currentClient;
      const wait = jest.spyOn(internals, '_waitForOpenSocket');

      await internals._recoverNotOpenSocketBeforeSubscriptionUpdate({
        client,
        reason: 'test',
      });

      expect(force).toHaveBeenCalledTimes(replaced ? 0 : 1);
      expect(wait).not.toHaveBeenCalled();
      expect(reconcile).not.toHaveBeenCalled();
      expect(internals._client).toBe(currentClient);
    },
  );

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
  const livenessInternals =
    ServiceHyperliquidSubscription.prototype as unknown as {
      getWebSocketClient: () => Promise<{
        transport: { socket: { readyState: number } };
      }>;
      _enqueueSubscriptionReconcile: () => Promise<void>;
    };
  beforeEach(() => {
    jest.spyOn(livenessInternals, 'getWebSocketClient').mockResolvedValue({
      transport: { socket: { readyState: WebSocket.OPEN } },
    });
    jest
      .spyOn(
        ServiceHyperliquidSubscription.prototype,
        'buildRequiredSubscriptionsMap',
      )
      .mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects a proof older than the latest disable', async () => {
    const service = createService();
    const update = jest
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
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
    jest
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
      .mockResolvedValue(undefined);
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
    jest
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
      .mockResolvedValue(undefined);
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
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
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
    jest
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
      .mockResolvedValue(undefined);
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
      .spyOn(livenessInternals, '_enqueueSubscriptionReconcile')
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

describe('ServiceHyperliquidSubscription instrument switch recovery', () => {
  const oldBook: ISubscriptionSpec<ESubscriptionType.L2> = {
    key: 'l2:BTC',
    type: ESubscriptionType.L2,
    params: { c: 'BTC' },
    priority: 1,
  };
  const newBook: ISubscriptionSpec<ESubscriptionType.L2> = {
    key: 'l2:ETH',
    type: ESubscriptionType.L2,
    params: { c: 'ETH' },
    priority: 1,
  };
  const allDexs: ISubscriptionSpec<ESubscriptionType.ALL_DEXS_ASSET_CTXS> = {
    key: 'allDexsAssetCtxs',
    type: ESubscriptionType.ALL_DEXS_ASSET_CTXS,
    params: {},
    priority: 2,
  };
  const allMids: ISubscriptionSpec<ESubscriptionType.ALL_MIDS> = {
    key: generateSubscriptionKey(ESubscriptionType.ALL_MIDS, {
      dex: 'ALL_DEXS',
    }),
    type: ESubscriptionType.ALL_MIDS,
    params: { dex: 'ALL_DEXS' },
    priority: 2,
  };

  function setupSwitch({
    activeSpecs = [oldBook, allDexs, allMids],
  }: {
    activeSpecs?: ISubscriptionSpec<ESubscriptionType>[];
  } = {}) {
    const fillsHistory = {
      getUserFillsByTime: jest
        .fn<Promise<IFill[]>, [IUserFillsByTimeParameters]>()
        .mockResolvedValue([]),
      appendTradesHistory: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquidCache: {
          flushPendingL2BookSnapshotCache: jest.fn(),
        },
        serviceHyperliquid: fillsHistory,
      } as unknown as IBackgroundApi,
    });
    const subscribe = jest
      .fn<Promise<void>, [ESubscriptionType, unknown]>()
      .mockResolvedValue(undefined);
    const unsubscribe = jest
      .fn<Promise<void>, [ESubscriptionType, unknown]>()
      .mockResolvedValue(undefined);
    const client = {
      clientId: 'test-connection',
      transport: { socket: { readyState: WebSocket.OPEN } },
      subscribe,
      unsubscribe,
      dispose: jest.fn().mockResolvedValue(undefined),
    };
    const activeSubscriptions = new Map(
      activeSpecs.map((spec) => [
        spec.key,
        {
          spec,
          key: spec.key,
          type: spec.type,
          isActive: true,
          createdAt: Date.now() - 20_000,
          lastActivity: Date.now(),
        },
      ]),
    );
    const internals = service as unknown as {
      _activeSubscriptions: typeof activeSubscriptions;
      _client: typeof client;
      _currentState: ISubscriptionState;
      _lastFrameAt: number | null;
      _lastMessageAt: number | null;
      _socketOpenedAt: number;
      _watchSubscriptionAtoms: () => void;
      getWebSocketClient: () => Promise<typeof client>;
    };
    internals._activeSubscriptions = activeSubscriptions;
    internals._client = client;
    internals._currentState = {
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      l2BookOptions: { nSigFigs: null, mantissa: null },
      orderBookTransport: 'l2',
      tradingMode: 'perp',
    };
    internals._lastFrameAt = Date.now();
    internals._lastMessageAt = Date.now();
    internals._socketOpenedAt = Date.now() - 30_000;
    service.allSubSpecsMap = Object.fromEntries(
      activeSpecs.map((spec) => [spec.key, spec]),
    );
    service.pendingSubSpecsMap = { ...service.allSubSpecsMap };
    jest
      .spyOn(internals, '_watchSubscriptionAtoms')
      .mockImplementation(() => {});
    jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
      requiredSubSpecsMap: {
        [newBook.key]: newBook,
        [allDexs.key]: allDexs,
        [allMids.key]: allMids,
      },
      params: {
        ...internals._currentState,
        currentSymbol: 'ETH',
      },
    });
    return {
      service,
      subscribe,
      unsubscribe,
      activeSubscriptions,
      internals,
      fillsHistory,
    };
  }

  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', true);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps global streams during a live switch to a different book', async () => {
    const { service, subscribe, unsubscribe } = setupSwitch();
    const proof = { disabledCount: 0, switchingToCoin: 'ETH' };

    const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
    await jest.advanceTimersByTimeAsync(100);

    await expect(recovery).resolves.toBe(true);
    expect(subscribe.mock.calls).toEqual([
      [ESubscriptionType.L2, { c: 'ETH' }],
    ]);
    expect(unsubscribe.mock.calls).toEqual([
      [ESubscriptionType.L2, { c: 'BTC' }],
    ]);
    expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      unsubscribe.mock.invocationCallOrder[0],
    );
  });

  it.each([false, true])(
    'restores BTC BBO after a late unsubscribe ACK (book also times out: %s)',
    async (bookTimesOut) => {
      const btcBook: ISubscriptionSpec<ESubscriptionType.L2_BOOK> = {
        key: 'l2Book:BTC',
        type: ESubscriptionType.L2_BOOK,
        params: { coin: 'BTC' },
        priority: 1,
      };
      const ethBook = {
        ...btcBook,
        key: 'l2Book:ETH',
        params: { coin: 'ETH' },
      };
      const btcBbo: ISubscriptionSpec<ESubscriptionType.BBO> = {
        key: 'bbo:BTC',
        type: ESubscriptionType.BBO,
        params: { coin: 'BTC' },
        priority: 2,
      };
      const ethBbo = { ...btcBbo, key: 'bbo:ETH', params: { coin: 'ETH' } };
      const { service, internals, subscribe, unsubscribe } = setupSwitch({
        activeSpecs: [btcBook, btcBbo, allDexs, allMids],
      });
      const oldClient = internals._client;
      const newClient = {
        ...oldClient,
        clientId: 'replacement-connection',
        transport: { socket: { readyState: WebSocket.OPEN } },
        subscribe: jest.fn().mockResolvedValue(undefined),
        unsubscribe: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
      };
      jest
        .spyOn(internals, 'getWebSocketClient')
        .mockImplementation(async () => {
          if (oldClient.dispose.mock.calls.length > 0) {
            internals._client = newClient;
          }
          return internals._client;
        });
      const lateAck = jest.fn<void, [ESubscriptionType]>();
      unsubscribe.mockImplementation(async (type) => {
        if (
          type === ESubscriptionType.BBO ||
          (bookTimesOut && type === ESubscriptionType.L2_BOOK)
        ) {
          // The server removed the subscription, but its ACK arrives after the
          // dispatcher has timed out and removed the matching request.
          setTimeout(() => lateAck(type), 5100);
          await new Promise<void>((_resolve, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 5000);
          });
        }
      });
      const switchTo = (
        book: ISubscriptionSpec<ESubscriptionType.L2_BOOK>,
        bbo: ISubscriptionSpec<ESubscriptionType.BBO>,
      ) => {
        jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
          requiredSubSpecsMap: {
            [book.key]: book,
            [bbo.key]: bbo,
            [allDexs.key]: allDexs,
            [allMids.key]: allMids,
          },
          params: {
            ...internals._currentState,
            currentSymbol: bbo.params.coin,
            orderBookTransport: 'l2Book',
          },
        });
        return service.recoverSubscriptionsAfterLivenessProof({
          disabledCount: 0,
          switchingToCoin: bbo.params.coin,
        });
      };

      const toEth = switchTo(ethBook, ethBbo);
      await jest.advanceTimersByTimeAsync(5100);
      await toEth;
      expect(subscribe).toHaveBeenCalledWith(ethBbo.type, ethBbo.params);
      expect(lateAck).toHaveBeenCalledWith(btcBbo.type);

      unsubscribe.mockResolvedValue(undefined);
      internals._lastMessageAt = Date.now();
      const toBtc = switchTo(btcBook, btcBbo);
      await jest.advanceTimersByTimeAsync(100);
      await toBtc;

      expect(subscribe).not.toHaveBeenCalledWith(btcBbo.type, btcBbo.params);
      expect(newClient.subscribe).toHaveBeenCalledWith(
        btcBbo.type,
        btcBbo.params,
      );
      expect(oldClient.dispose).toHaveBeenCalledTimes(1);
      expect(newClient.dispose).not.toHaveBeenCalled();
    },
  );

  function setupBboUnsubscribeTimeout() {
    const user = '0x123';
    const oldBbo: ISubscriptionSpec<ESubscriptionType.BBO> = {
      key: 'bbo:BTC',
      type: ESubscriptionType.BBO,
      params: { coin: 'BTC' },
      priority: 2,
    };
    const targetBbo = { ...oldBbo, key: 'bbo:ETH', params: { coin: 'ETH' } };
    const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
      key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, { user }),
      type: ESubscriptionType.USER_FILLS,
      params: { user },
      priority: 2,
    };
    const env = setupSwitch({ activeSpecs: [oldBbo, fills, allDexs, allMids] });
    const { service, internals, unsubscribe } = env;
    const original = internals._client;
    const replacement = {
      ...original,
      clientId: 'replacement',
      transport: { socket: { readyState: WebSocket.OPEN } },
      subscribe: jest.fn<Promise<void>, [ESubscriptionType, unknown]>(),
      unsubscribe: jest.fn<Promise<void>, [ESubscriptionType, unknown]>(),
      dispose: jest.fn<Promise<void>, []>(),
    };
    jest.spyOn(internals, 'getWebSocketClient').mockImplementation(async () => {
      internals._client ??= replacement;
      return internals._client;
    });
    internals._currentState.currentUser = user;
    jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
      requiredSubSpecsMap: Object.fromEntries(
        [targetBbo, fills, allDexs, allMids].map((spec) => [spec.key, spec]),
      ),
      params: { ...internals._currentState, currentSymbol: 'ETH' },
    });
    unsubscribe.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), 5000);
        }),
    );
    return { ...env, original, replacement, fills, oldBbo, targetBbo };
  }

  function makeFill(tid: number, time: number): IFill {
    return {
      coin: 'ETH',
      px: '2000',
      sz: '1',
      side: 'B',
      time,
      startPosition: '0',
      dir: 'Open Long',
      closedPnl: '0',
      hash: `0x${'a'.repeat(64)}`,
      oid: 12,
      crossed: false,
      fee: '0.42',
      tid,
      feeToken: 'USDC',
      twapId: null,
    };
  }

  it('merges overlapping recovered fills and concurrent live fills once each', async () => {
    const history = Object.create(
      ServiceHyperliquid.prototype,
    ) as ServiceHyperliquid;
    const user = '0x123';
    const overlap = makeFill(1, 4990);
    const recovered = makeFill(2, 5050);
    const live = makeFill(3, 5110);
    const previous = await perpsTradesHistoryDataAtom.get();
    try {
      await perpsTradesHistoryDataAtom.set({
        fills: [overlap],
        isLoaded: true,
        latestTime: overlap.time,
        accountAddress: user,
      });
      await Promise.all([
        history.appendTradesHistory([overlap, recovered], user),
        history.appendTradesHistory([live], user),
      ]);
      const result = await perpsTradesHistoryDataAtom.get();
      expect(result.fills).toEqual([live, recovered, overlap]);
      expect(result.latestTime).toBe(live.time);
    } finally {
      await perpsTradesHistoryDataAtom.set(previous);
    }
  });

  it('does not backfill user fills when the BBO unsubscribe succeeds', async () => {
    const { service, unsubscribe, fillsHistory } = setupBboUnsubscribeTimeout();
    unsubscribe.mockReset().mockResolvedValue(undefined);
    await service.updateSubscriptions();
    expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps user fills live when blurring during BBO recovery (reset already requested: %s)',
    async (requested) => {
      const {
        service,
        original,
        unsubscribe,
        subscribe,
        fills,
        targetBbo,
        fillsHistory,
      } = setupBboUnsubscribeTimeout();
      const refresh = jest
        .spyOn(perpsTradesHistoryRefreshHookAtom, 'set')
        .mockResolvedValue(undefined);
      let finishInvalidation: (() => void) | undefined;
      if (requested) {
        jest
          .spyOn(perpsLiquidationRiskInputsAtom, 'set')
          .mockImplementationOnce(
            () =>
              new Promise<void>((resolve) => {
                finishInvalidation = resolve;
              }),
          );
      }
      const switching = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.BBO, {
        coin: 'BTC',
      });

      if (!requested) {
        await service.disableSubscriptionsHandler();
      }
      await jest.advanceTimersByTimeAsync(5000);
      if (requested) {
        expect(finishInvalidation).toBeDefined();
        await service.disableSubscriptionsHandler();
        finishInvalidation?.();
      }
      await switching;
      expect(original.dispose).not.toHaveBeenCalled();

      const receive = service as unknown as {
        _handleSubscriptionData: (
          type: ESubscriptionType,
          event: CustomEvent,
        ) => Promise<void>;
      };
      await receive._handleSubscriptionData(
        fills.type,
        new CustomEvent(fills.type, {
          detail: { user: fills.params.user, fills: [{}], isSnapshot: false },
        }),
      );
      expect(refresh).not.toHaveBeenCalled();
      const resume = service.resumeSubscriptions();
      await jest.advanceTimersByTimeAsync(100);
      await resume;
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledTimes(2);
      expect(subscribe).toHaveBeenLastCalledWith(
        targetBbo.type,
        targetBbo.params,
      );
      expect(original.dispose).not.toHaveBeenCalled();
      expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'recovers a refocus racing a BBO timeout (socket already reopened: %s)',
    async (reopened) => {
      const {
        service,
        internals,
        original,
        replacement,
        unsubscribe,
        oldBbo,
        targetBbo,
        fills,
      } = setupBboUnsubscribeTimeout();
      unsubscribe.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            setTimeout(
              () => reject(new Error('WebSocket connection closed')),
              20,
            );
          }),
      );
      const switching = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      await service.disableSubscriptionsHandler();
      const resume = service.resumeSubscriptions();
      await jest.advanceTimersByTimeAsync(5000);
      if (reopened) {
        internals._socketOpenedAt = Date.now();
      }
      await jest.advanceTimersByTimeAsync(100);
      await Promise.all([switching, resume]);

      expect(unsubscribe).toHaveBeenNthCalledWith(
        2,
        oldBbo.type,
        oldBbo.params,
      );
      expect(original.dispose).toHaveBeenCalledTimes(reopened ? 0 : 1);
      expect(replacement.dispose).not.toHaveBeenCalled();
      if (!reopened) {
        await service.updateSubscriptions();
        expect(replacement.subscribe).toHaveBeenCalledWith(
          targetBbo.type,
          targetBbo.params,
        );
        expect(replacement.subscribe).toHaveBeenCalledWith(
          fills.type,
          fills.params,
        );
      }
    },
  );

  it('reconnects when closed-socket resume joins a cancelled BBO reset', async () => {
    const { service, original } = setupBboUnsubscribeTimeout();
    let finishInvalidation: (() => void) | undefined;
    jest.spyOn(perpsLiquidationRiskInputsAtom, 'set').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishInvalidation = resolve;
        }),
    );
    const switching = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(5000);
    expect(finishInvalidation).toBeDefined();

    Object.assign(original.transport.socket, { readyState: WebSocket.CLOSED });
    const resume = service.resumeSubscriptions();
    finishInvalidation?.();
    await Promise.all([switching, resume]);

    expect(original.dispose).toHaveBeenCalledTimes(1);
  });

  it('retries BBO recovery for the latest focus after an earlier focus cancels', async () => {
    const { service, original, unsubscribe, oldBbo } =
      setupBboUnsubscribeTimeout();
    let finishInvalidation: (() => void) | undefined;
    jest.spyOn(perpsLiquidationRiskInputsAtom, 'set').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishInvalidation = resolve;
        }),
    );
    const switching = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(5000);
    expect(finishInvalidation).toBeDefined();

    await service.disableSubscriptionsHandler();
    unsubscribe.mockRejectedValueOnce(new Error('Request timed out'));
    const resume = service.resumeSubscriptions();
    await jest.advanceTimersByTimeAsync(0);
    expect(unsubscribe).toHaveBeenNthCalledWith(2, oldBbo.type, oldBbo.params);
    finishInvalidation?.();
    await Promise.all([switching, resume]);

    expect(original.dispose).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'backfills after the replacement subscription when blur lands during recovery (changed account: %s)',
    async (changedAccount) => {
      jest.setSystemTime(new Date('2026-11-21T00:00:00.000Z'));
      const {
        service,
        internals,
        original,
        replacement,
        fills,
        fillsHistory,
        targetBbo,
      } = setupBboUnsubscribeTimeout();
      const disconnectAt = Date.now() + 5000;
      const fill = makeFill(123, disconnectAt + 50);
      fillsHistory.getUserFillsByTime.mockImplementation(
        async ({ startTime, endTime }) =>
          Number(startTime) <= fill.time && fill.time <= Number(endTime)
            ? [fill]
            : [],
      );
      original.dispose.mockImplementation(async () => {
        await service.disableSubscriptionsHandler();
        Object.assign(replacement.transport.socket, {
          readyState: WebSocket.CONNECTING,
        });
      });
      const switching = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(5000);
      await switching;
      expect(original.dispose).toHaveBeenCalledTimes(1);
      await service.resumeSubscriptions();
      expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();

      if (changedAccount) {
        const user = '0x456';
        const nextFills = {
          ...fills,
          key: generateSubscriptionKey(fills.type, { user }),
          params: { user },
        } satisfies typeof fills;
        jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
          requiredSubSpecsMap: Object.fromEntries(
            [targetBbo, nextFills, allDexs, allMids].map((spec) => [
              spec.key,
              spec,
            ]),
          ),
          params: {
            ...internals._currentState,
            currentSymbol: 'ETH',
            currentUser: user,
          },
        });
      }
      let acknowledgeFills: (() => void) | undefined;
      replacement.subscribe.mockImplementation(async (type) => {
        if (type === fills.type) {
          await new Promise<void>((resolve) => {
            acknowledgeFills = resolve;
          });
        }
      });
      replacement.transport.socket.readyState = WebSocket.OPEN;
      const update = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(100);
      expect(acknowledgeFills).toBeDefined();
      expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
      acknowledgeFills?.();
      await update;

      if (changedAccount) {
        expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
        expect(fillsHistory.appendTradesHistory).not.toHaveBeenCalled();
        return;
      }
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledWith({
        user: fills.params.user,
        startTime: disconnectAt - 5000,
        endTime: Date.now(),
        reversed: true,
      });
      expect(fillsHistory.appendTradesHistory).toHaveBeenCalledWith(
        [fill],
        fills.params.user,
      );
    },
  );

  it('keeps global streams while the target book subscribe awaits its ack', async () => {
    const { service, subscribe, unsubscribe } = setupSwitch({
      activeSpecs: [allDexs, allMids],
    });
    let acknowledgeBook: (() => void) | undefined;
    subscribe.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          acknowledgeBook = resolve;
        }),
    );
    const update = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(0);
    expect(subscribe).toHaveBeenCalledWith(ESubscriptionType.L2, {
      c: 'ETH',
    });
    const proof = { disabledCount: 0, switchingToCoin: 'ETH' };
    const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
    await jest.advanceTimersByTimeAsync(0);
    acknowledgeBook?.();
    await jest.advanceTimersByTimeAsync(100);

    await update;
    await expect(recovery).resolves.toBe(true);
    expect(subscribe.mock.calls).toEqual([
      [ESubscriptionType.L2, { c: 'ETH' }],
    ]);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: 'quiet for a normal interval',
      createdMsAgo: 60_000,
      activityMsAgo: 12_600,
      shouldRebuild: false,
    },
    {
      status: 'silent for over 30 seconds',
      createdMsAgo: 60_000,
      activityMsAgo: 31_000,
      shouldRebuild: true,
    },
    {
      status: 'newly acknowledged with no frame yet',
      createdMsAgo: 200,
      activityMsAgo: 200,
      shouldRebuild: false,
    },
  ])(
    'preserves global streams on a switch unless allMids is stale ($status)',
    async ({ createdMsAgo, activityMsAgo, shouldRebuild }) => {
      const {
        service,
        subscribe,
        unsubscribe,
        activeSubscriptions,
        internals,
      } = setupSwitch();
      const mids = activeSubscriptions.get(allMids.key);
      if (!mids) {
        throw new OneKeyLocalError('Expected an active allMids subscription');
      }
      internals._socketOpenedAt = Date.now() - 90_000;
      mids.createdAt = Date.now() - createdMsAgo;
      mids.lastActivity = Date.now() - activityMsAgo;

      const recovery = service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: 0,
        switchingToCoin: 'ETH',
      });
      await jest.advanceTimersByTimeAsync(100);

      await expect(recovery).resolves.toBe(true);
      if (shouldRebuild) {
        expect(unsubscribe).toHaveBeenCalledWith(
          ESubscriptionType.ALL_MIDS,
          allMids.params,
        );
        expect(subscribe).toHaveBeenCalledWith(
          ESubscriptionType.ALL_MIDS,
          allMids.params,
        );
        expect(subscribe).toHaveBeenCalledWith(
          ESubscriptionType.ALL_DEXS_ASSET_CTXS,
          {},
        );
      } else {
        expect(subscribe.mock.calls).toEqual([
          [ESubscriptionType.L2, { c: 'ETH' }],
        ]);
        expect(unsubscribe.mock.calls).toEqual([
          [ESubscriptionType.L2, { c: 'BTC' }],
        ]);
      }
    },
  );

  it.each(['missing', 'stale'] as const)(
    'rebuilds the live socket when the global critical stream is %s',
    async (globalStatus) => {
      const { service, subscribe, unsubscribe, activeSubscriptions } =
        setupSwitch({
          activeSpecs:
            globalStatus === 'missing'
              ? [oldBook, allMids]
              : [oldBook, allMids, allDexs],
        });
      const dexSubscription = activeSubscriptions.get(allDexs.key);
      if (dexSubscription) {
        dexSubscription.lastActivity = Date.now() - 20_000;
      }
      const proof = { disabledCount: 0, switchingToCoin: 'ETH' };

      const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
      await jest.advanceTimersByTimeAsync(100);

      await expect(recovery).resolves.toBe(true);
      expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.ALL_MIDS, {
        dex: 'ALL_DEXS',
      });
      expect(subscribe).toHaveBeenCalledWith(
        ESubscriptionType.ALL_DEXS_ASSET_CTXS,
        {},
      );
    },
  );

  it.each(['muted', 'enabled with stale BBO'] as const)(
    'keeps full recovery for a previously muted handler that is %s',
    async (handlerStatus) => {
      const bbo: ISubscriptionSpec<ESubscriptionType.BBO> = {
        key: 'bbo:BTC',
        type: ESubscriptionType.BBO,
        params: { coin: 'BTC' },
        priority: 2,
      };
      const { service, unsubscribe } = setupSwitch({
        activeSpecs: [oldBook, allDexs, allMids, bbo],
      });
      await service.disableSubscriptionsHandler();
      if (handlerStatus === 'enabled with stale BBO') {
        await service.enableSubscriptionsHandler();
      }
      const disabledCount =
        await service.getSubscriptionsHandlerDisabledCount();
      const proof = { disabledCount, switchingToCoin: 'ETH' };

      const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
      await jest.advanceTimersByTimeAsync(100);

      await expect(recovery).resolves.toBe(true);
      expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.BBO, {
        coin: 'BTC',
      });
      expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.ALL_MIDS, {
        dex: 'ALL_DEXS',
      });
    },
  );

  it('keeps full recovery when recent frames belong to the previous connection', async () => {
    const { service, unsubscribe, internals } = setupSwitch();
    internals._lastMessageAt = Date.now() - 100;
    internals._lastFrameAt = Date.now() - 100;
    internals._socketOpenedAt = Date.now() - 10;
    const proof = { disabledCount: 0, switchingToCoin: 'ETH' };

    const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
    await jest.advanceTimersByTimeAsync(100);

    await expect(recovery).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.ALL_MIDS, {
      dex: 'ALL_DEXS',
    });
  });

  it('keeps full recovery for ordinary resume', async () => {
    const { service, unsubscribe } = setupSwitch();

    const recovery = service.resumeSubscriptions();
    await jest.advanceTimersByTimeAsync(100);

    await recovery;
    expect(unsubscribe).toHaveBeenCalledWith(ESubscriptionType.ALL_MIDS, {
      dex: 'ALL_DEXS',
    });
  });

  it.each(['refocused', 'disabled again', 'closed', 'already forced'] as const)(
    'handles BBO recovery after a delayed book ACK when %s',
    async (state) => {
      const {
        activeSubscriptions,
        internals,
        service,
        subscribe,
        unsubscribe,
      } = setupSwitch();
      const newBbo: ISubscriptionSpec<ESubscriptionType.BBO> = {
        key: 'bbo:ETH',
        type: ESubscriptionType.BBO,
        params: { coin: 'ETH' },
        priority: 2,
      };
      jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
        requiredSubSpecsMap: {
          [newBook.key]: newBook,
          [newBbo.key]: newBbo,
          [allDexs.key]: allDexs,
          [allMids.key]: allMids,
        },
        params: { ...internals._currentState, currentSymbol: 'ETH' },
      });
      const receive = service as unknown as {
        _handleSubscriptionData: (
          type: ESubscriptionType,
          event: CustomEvent,
        ) => Promise<void>;
      };
      const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
      const bboUpdates = () =>
        emit.mock.calls
          .filter(([name, payload]) => {
            return (
              name === EAppEventBusNames.HyperliquidDataUpdate &&
              (payload as { subType: ESubscriptionType }).subType ===
                ESubscriptionType.BBO
            );
          })
          .map(([, payload]) => (payload as { data: unknown }).data);

      let acknowledgeBook: (() => void) | undefined;
      subscribe.mockImplementation(async (type) => {
        if (type === ESubscriptionType.L2 && !acknowledgeBook) {
          await new Promise<void>((resolve) => {
            acknowledgeBook = resolve;
          });
        }
        if (type === ESubscriptionType.BBO) {
          await receive._handleSubscriptionData(
            type,
            new CustomEvent(type, {
              detail: {
                coin: 'ETH',
                time: Date.now(),
                bbo: [
                  { px: '1999', sz: '1', n: 1 },
                  { px: '2000', sz: '1', n: 1 },
                ],
              },
            }),
          );
        }
      });
      const recovery =
        state === 'already forced'
          ? service.resumeSubscriptions({ forceRebuild: true })
          : service.recoverSubscriptionsAfterLivenessProof({
              disabledCount: 0,
              switchingToCoin: 'ETH',
            });
      await jest.advanceTimersByTimeAsync(100);
      expect(acknowledgeBook).toBeDefined();
      expect(activeSubscriptions.has(newBbo.key)).toBe(true);
      expect(bboUpdates().at(-1)).toMatchObject({ coin: 'ETH' });

      await service.disableSubscriptionsHandler();
      expect(bboUpdates().at(-1)).toBeNull();
      const refocus = service.resumeSubscriptions(
        state === 'already forced' ? { forceRebuild: true } : undefined,
      );
      const secondRefocus = service.resumeSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      if (state === 'disabled again') {
        await service.disableSubscriptionsHandler();
        await service.enableSubscriptionsHandler();
      } else if (state === 'closed') {
        const { socket } = internals._client.transport;
        Object.assign(socket, { readyState: WebSocket.CLOSED });
        service.socketCloseHandler({
          target: socket,
        } as unknown as WebSocketEventMap['close']);
      }

      acknowledgeBook?.();
      await jest.advanceTimersByTimeAsync(100);
      await Promise.all([recovery, refocus, secondRefocus]);

      const shouldRefresh = state === 'refocused' || state === 'already forced';
      expect(
        unsubscribe.mock.calls.filter(([type]) => type === newBbo.type),
      ).toHaveLength(shouldRefresh ? 1 : 0);
      expect(
        unsubscribe.mock.calls.filter(([type]) => type === allMids.type),
      ).toHaveLength(state === 'already forced' ? 1 : 0);
      if (shouldRefresh) {
        expect(bboUpdates().at(-1)).toMatchObject({ coin: 'ETH' });
      } else {
        expect(bboUpdates().at(-1)).toBeNull();
      }
    },
  );

  it.each(['live', 'disabled again', 'closed', 'already rebuilding'] as const)(
    'handles concurrent forced resumes during a book ACK when %s',
    async (state) => {
      const {
        activeSubscriptions,
        internals,
        service,
        subscribe,
        unsubscribe,
      } = setupSwitch();
      const ctx = activeSubscriptions.get(allDexs.key);
      if (state === 'already rebuilding' && ctx) {
        ctx.lastActivity = Date.now() - 20_000;
      }

      let acknowledgeBook: (() => void) | undefined;
      subscribe.mockImplementation((type) => {
        if (type !== ESubscriptionType.L2 || acknowledgeBook) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          acknowledgeBook = resolve;
        });
      });
      const recovery = service.recoverSubscriptionsAfterLivenessProof({
        disabledCount: 0,
        switchingToCoin: 'ETH',
      });
      await jest.advanceTimersByTimeAsync(100);
      expect(acknowledgeBook).toBeDefined();

      const force = service.resumeSubscriptions({ forceRebuild: true });
      const secondForce = service.resumeSubscriptions({ forceRebuild: true });
      await jest.advanceTimersByTimeAsync(0);

      if (state === 'disabled again') {
        await service.disableSubscriptionsHandler();
        await service.enableSubscriptionsHandler();
      } else if (state === 'closed') {
        const { socket } = internals._client.transport;
        Object.assign(socket, { readyState: WebSocket.CLOSED });
        service.socketCloseHandler({
          target: socket,
        } as unknown as WebSocketEventMap['close']);
      }

      const latestBook = { ...newBook, key: 'l2:SOL', params: { c: 'SOL' } };
      jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
        requiredSubSpecsMap: {
          [latestBook.key]: latestBook,
          [allDexs.key]: allDexs,
          [allMids.key]: allMids,
        },
        params: { ...internals._currentState, currentSymbol: 'SOL' },
      });
      acknowledgeBook?.();
      await jest.advanceTimersByTimeAsync(100);
      await Promise.all([recovery, force, secondForce]);

      expect(
        unsubscribe.mock.calls.filter(([type]) => type === allMids.type),
      ).toHaveLength(
        state === 'live' || state === 'already rebuilding' ? 1 : 0,
      );
      expect(
        subscribe.mock.calls.filter(([type]) => type === ESubscriptionType.L2),
      ).toEqual(
        state === 'live'
          ? [
              [ESubscriptionType.L2, { c: 'ETH' }],
              [ESubscriptionType.L2, { c: 'SOL' }],
            ]
          : [[ESubscriptionType.L2, { c: 'ETH' }]],
      );
    },
  );

  it('rejects a proof invalidated during enable even after a newer enable', async () => {
    const { service, subscribe, unsubscribe } = setupSwitch();
    const emit = jest.spyOn(appEventBus, 'emit').mockReturnValue(true);
    const enable = service.enableSubscriptionsHandler.bind(service);
    jest
      .spyOn(service, 'enableSubscriptionsHandler')
      .mockImplementationOnce(async (options) => {
        await enable(options);
        await service.disableSubscriptionsHandler();
        await enable();
      });
    const proof = { disabledCount: 0, switchingToCoin: 'ETH' };

    const recovery = service.recoverSubscriptionsAfterLivenessProof(proof);
    await jest.advanceTimersByTimeAsync(100);

    await expect(recovery).resolves.toBe(false);
    expect(service.subscriptionsHandlerDisabled).toBe(false);
    expect(emit).not.toHaveBeenCalledWith(
      EAppEventBusNames.PerpsSubscriptionsRecovered,
      undefined,
    );
    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});

describe('ServiceHyperliquidSubscription public trades', () => {
  const unsubscribe = jest.fn<Promise<void>, []>();
  const close = jest.fn<void, []>();
  const trades = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe.mockResolvedValue(undefined);
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

describe('ServiceHyperliquidSubscription network status', () => {
  type INetworkInternals = {
    _client: unknown;
    _startPingLoop: () => void;
    _updateNetworkLiveness: () => void;
  };

  const closeEvent = {
    target: { readyState: 3 },
  } as unknown as WebSocketEventMap['close'];
  const openEvent = {
    target: { readyState: 1 },
  } as unknown as WebSocketEventMap['open'];

  const getConnected = async () =>
    (await perpsNetworkStatusAtom.get()).connected;

  const setupOnlineService = async () => {
    const service = createService();
    const internals = service as unknown as INetworkInternals;
    jest.spyOn(internals, '_startPingLoop').mockImplementation(() => {});
    jest.spyOn(service, 'updateSubscriptions').mockResolvedValue(undefined);
    await perpsNetworkStatusAtom.set({
      connected: undefined,
      lastMessageAt: null,
    });
    const published: Array<boolean | undefined> = [];
    const unsubscribe = perpsNetworkStatusAtom.sub(() => {
      void perpsNetworkStatusAtom.get().then(({ connected }) => {
        if (published[published.length - 1] !== connected) {
          published.push(connected);
        }
      });
    });
    const receiveFrame = async () => {
      internals._updateNetworkLiveness();
      await jest.advanceTimersByTimeAsync(0);
    };
    const streamFor = async (ms: number) => {
      for (let elapsed = 0; elapsed < ms; elapsed += 500) {
        await jest.advanceTimersByTimeAsync(500);
        await receiveFrame();
      }
    };
    const dropSocket = async () => {
      service.socketCloseHandler(closeEvent);
      await jest.advanceTimersByTimeAsync(0);
    };
    const reopenSocket = async () => {
      internals._client = { transport: { socket: { readyState: 1 } } };
      service.socketOpenHandler(openEvent);
      await jest.advanceTimersByTimeAsync(0);
    };
    await receiveFrame();
    return {
      service,
      internals,
      published,
      unsubscribe,
      receiveFrame,
      streamFor,
      dropSocket,
      reopenSocket,
    };
  };

  let cleanupStatusRecorder: (() => void) | undefined;

  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
    const g = globalThis as { WebSocket?: unknown };
    if (typeof g.WebSocket === 'undefined') {
      g.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
    }
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanupStatusRecorder?.();
    cleanupStatusRecorder = undefined;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('never publishes a drop that recovers within the grace window', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;

    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(1000);
    // The transport re-dispatches close for every failed retry.
    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(2000);
    await env.reopenSocket();
    await env.streamFor(HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS * 3);

    expect(env.published).toEqual([true]);
  });

  it('publishes offline once a dropped socket stays down for the grace window', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;

    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(
      HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS - 1,
    );
    expect(await getConnected()).toBe(true);
    await jest.advanceTimersByTimeAsync(1);
    expect(await getConnected()).toBe(false);

    // Failed retries and a subscription teardown are not proof of a connection.
    for (let retry = 0; retry < 5; retry += 1) {
      await jest.advanceTimersByTimeAsync(8000);
      await env.dropSocket();
    }
    await env.service.pauseSubscriptions();
    await jest.advanceTimersByTimeAsync(0);
    expect(await getConnected()).toBe(false);

    await env.service.enableSubscriptionsHandler();
    await env.receiveFrame();
    expect(env.published).toEqual([true, false, true]);
  });

  it('publishes offline when an open socket stops delivering frames', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;
    await env.streamFor(10_000);

    // No close event: the socket stays OPEN while nothing gets through.
    await jest.advanceTimersByTimeAsync(
      HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS - 1,
    );
    expect(await getConnected()).toBe(true);
    await jest.advanceTimersByTimeAsync(1);

    expect(await getConnected()).toBe(false);
  });

  it('publishes offline when a reopened socket never delivers frames', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;

    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(1000);
    await env.reopenSocket();
    await jest.advanceTimersByTimeAsync(
      HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS - 1,
    );
    expect(await getConnected()).toBe(true);
    await jest.advanceTimersByTimeAsync(1);

    expect(await getConnected()).toBe(false);
  });

  it('keeps a published offline until a reopened socket delivers a frame', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;
    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS);

    await env.reopenSocket();
    expect(await getConnected()).toBe(false);

    await env.receiveFrame();
    expect(await getConnected()).toBe(true);
  });

  it('does not read muted frames as silence after leaving Perps', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;

    await env.service.disableSubscriptionsHandler();
    await jest.advanceTimersByTimeAsync(
      HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS * 10,
    );

    expect(env.published).toEqual([true]);
  });

  it('drops a stale offline verdict when the socket reopens while muted', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;
    await env.dropSocket();
    await jest.advanceTimersByTimeAsync(HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS);
    expect(await getConnected()).toBe(false);

    await env.service.disableSubscriptionsHandler();
    await env.reopenSocket();

    expect(await getConnected()).toBeUndefined();
  });

  it('gives a frozen runtime a fresh window instead of publishing offline', async () => {
    const env = await setupOnlineService();
    cleanupStatusRecorder = env.unsubscribe;
    await env.dropSocket();

    // App backgrounded or system asleep: the clock moves, timers do not.
    jest.setSystemTime(Date.now() + 60_000);
    await jest.advanceTimersByTimeAsync(HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS);
    expect(await getConnected()).toBe(true);

    await env.reopenSocket();
    await env.streamFor(HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS * 2);
    expect(env.published).toEqual([true]);
  });
});

describe('ServiceHyperliquidSubscription transport replacement', () => {
  type ITransportInternals = {
    _activeSubscriptions: Map<string, unknown>;
    _closeClient: () => Promise<void>;
    _createSubscription: (
      spec: ISubscriptionSpec<ESubscriptionType>,
    ) => Promise<void>;
    _executeSubscriptionChanges: () => Promise<void>;
    _forceReconnectTransport: () => Promise<void>;
    getWebSocketClient: () => Promise<unknown>;
  };

  const staleOrderBook: ISubscriptionSpec<ESubscriptionType.L2> = {
    type: ESubscriptionType.L2,
    key: 'l2:xyz:NVDA',
    params: { c: 'xyz:NVDA' },
    priority: 3,
  };
  const currentOrderBook: ISubscriptionSpec<ESubscriptionType.L2> = {
    type: ESubscriptionType.L2,
    key: 'l2:BTC',
    params: { c: 'BTC' },
    priority: 3,
  };

  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not keep rebuilding over an order book the old transport could not unsubscribe', async () => {
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquidCache: {
          flushPendingL2BookSnapshotCache: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    const internals = service as unknown as ITransportInternals;
    // Offline switch NVDA -> BTC: the NVDA unsubscribe can never be matched,
    // because the server replies "Already unsubscribed" with normalized params
    // that the SDK compares exactly.
    const unsubscribe = jest
      .fn()
      .mockRejectedValue(new Error('TimeoutError: signal timed out'));
    jest
      .spyOn(internals, 'getWebSocketClient')
      .mockResolvedValue({ unsubscribe });
    jest.spyOn(internals, '_closeClient').mockResolvedValue(undefined);
    jest.spyOn(internals, '_createSubscription').mockResolvedValue(undefined);
    const reconnect = jest.spyOn(internals, '_forceReconnectTransport');
    service.allSubSpecsMap = {
      [staleOrderBook.key]: staleOrderBook,
      [currentOrderBook.key]: currentOrderBook,
    };
    service.pendingSubSpecsMap = { [currentOrderBook.key]: currentOrderBook };

    await internals._executeSubscriptionChanges();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledTimes(1);

    // Every socket opened afterwards reconciles against the same targets.
    for (let socket = 0; socket < 3; socket += 1) {
      await internals._executeSubscriptionChanges();
    }
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(service.allSubSpecsMap[staleOrderBook.key]).toBeUndefined();
  });

  it('still unsubscribes specs the current transport holds', async () => {
    const service = createService();
    const internals = service as unknown as ITransportInternals & {
      _destroySubscription: (
        spec: ISubscriptionSpec<ESubscriptionType>,
      ) => Promise<boolean>;
    };
    const unsubscribe = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(internals, 'getWebSocketClient')
      .mockResolvedValue({ unsubscribe });
    service.allSubSpecsMap = { [currentOrderBook.key]: currentOrderBook };

    await expect(
      internals._destroySubscription(currentOrderBook),
    ).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledWith(
      ESubscriptionType.L2,
      currentOrderBook.params,
    );

    service.socketCloseHandler({
      target: { readyState: 3 },
    } as unknown as WebSocketEventMap['close']);
    await expect(
      internals._destroySubscription(currentOrderBook),
    ).resolves.toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
