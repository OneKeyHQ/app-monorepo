import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  isAppVisible,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';
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
jest.mock('@onekeyhq/shared/src/utils/appVisibility', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/appVisibility')
  >('@onekeyhq/shared/src/utils/appVisibility'),
  getCurrentVisibilityState: jest.fn(() => true),
  isAppVisible: jest.fn(() => true),
  onVisibilityStateChange: jest.fn(() => () => undefined),
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

function createService() {
  return new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  });
}

describe('ServiceHyperliquidSubscription Fast L2 lifecycle', () => {
  beforeAll(() => {
    globalJotaiStorageReadyHandler.resolveReady(true);
  });

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createFastL2Recovery() {
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquidCache: {
          flushPendingL2BookSnapshotCache: jest.fn(),
        },
      } as unknown as IBackgroundApi,
    });
    const unsubscribe = Promise.withResolvers<void>();
    const unsubscribeRequest = jest.fn(() => unsubscribe.promise);
    const original = {
      transport: { socket: { readyState: 1 } },
      unsubscribe: unsubscribeRequest,
      dispose: jest.fn(async () => {
        if (unsubscribeRequest.mock.calls.length > 0) {
          unsubscribe.reject(
            new Error('WebSocket connection permanently terminated'),
          );
        }
      }),
    };
    const replacement = {
      transport: { socket: { readyState: 1 } },
      unsubscribe: jest.fn(async () => {}),
      dispose: jest.fn(async () => {}),
    };
    const user = '0x123';
    const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
      key: 'userFills:account',
      type: ESubscriptionType.USER_FILLS,
      params: { user },
      priority: 2,
    };
    const internals = service as unknown as {
      _client: typeof original | typeof replacement | null;
      _activeSubscriptions: Map<
        string,
        { type: typeof fills.type; spec: typeof fills }
      >;
      _interruptedBboReconnectFills: Map<string, { disconnectedAt: number }>;
      _fastL2TargetKey: string;
      _fastL2FallbackTargetKey: string | null;
      _fastL2RecoveryAttempts: number;
      _fastL2ReconnectAttempted: boolean;
      _recoverFastL2: (reason: string) => Promise<void>;
      _forceReconnectTransport: () => Promise<boolean>;
      _reconnectTransportSingleFlight: (request?: {
        canReconnect?: () => boolean;
        captureUserFills?: boolean;
      }) => Promise<void>;
      getWebSocketClient: () => Promise<typeof original | typeof replacement>;
    };
    const spec: ISubscriptionSpec<ESubscriptionType.L2> = {
      key: 'l2:ETH',
      type: ESubscriptionType.L2,
      params: { c: 'ETH' },
      priority: 2,
    };
    service.pendingSubSpecsMap = { [spec.key]: spec, [fills.key]: fills };
    service.allSubSpecsMap = { [spec.key]: spec };
    internals._activeSubscriptions.set(fills.key, {
      type: fills.type,
      spec: fills,
    });
    internals._fastL2TargetKey = spec.key;
    internals._client = original;
    jest.spyOn(internals, 'getWebSocketClient').mockImplementation(async () => {
      internals._client ??= replacement;
      return internals._client;
    });
    return {
      service,
      internals,
      original,
      replacement,
      unsubscribe,
      spec,
      user,
    };
  }

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

  it('does not close the replacement when BBO recovery aborts the old Fast L2 unsubscribe', async () => {
    const { internals, original, replacement } = createFastL2Recovery();
    const reconnect = jest.spyOn(internals, '_forceReconnectTransport');
    const fastL2 = internals._recoverFastL2('snapshot_timeout');
    await jest.advanceTimersByTimeAsync(0);
    expect(original.unsubscribe).toHaveBeenCalledTimes(1);

    await internals._reconnectTransportSingleFlight({
      canReconnect: () => true,
      captureUserFills: true,
    });
    await fastL2;

    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(original.dispose).toHaveBeenCalledTimes(1);
    expect(replacement.dispose).not.toHaveBeenCalled();
    expect(internals._client).toBe(replacement);
  });

  it.each([false, true])(
    'keeps a live transport when blur invalidates BBO and Fast L2 times out (refocused: %s)',
    async (refocused) => {
      const { service, internals, original, unsubscribe } =
        createFastL2Recovery();
      const invalidate = Promise.withResolvers<void>();
      const setRiskInputs = jest
        .spyOn(perpsLiquidationRiskInputsAtom, 'set')
        .mockReturnValueOnce(invalidate.promise);
      const fastL2 = internals._recoverFastL2('snapshot_timeout');
      await jest.advanceTimersByTimeAsync(0);
      expect(original.unsubscribe).toHaveBeenCalledTimes(1);
      const bbo = internals._reconnectTransportSingleFlight({
        canReconnect: () => service.subscriptionsHandlerDisabledCount === 0,
        captureUserFills: true,
      });
      expect(setRiskInputs).toHaveBeenCalledTimes(1);
      await service.disableSubscriptionsHandler();
      if (refocused) {
        await service.enableSubscriptionsHandler();
      }
      unsubscribe.reject(new Error('Request timed out after 5000 ms'));
      await jest.advanceTimersByTimeAsync(0);
      invalidate.resolve();
      await Promise.all([bbo, fastL2]);

      expect(original.dispose).not.toHaveBeenCalled();
      expect(internals._client).toBe(original);
      expect(internals._fastL2ReconnectAttempted).toBe(false);

      await service.enableSubscriptionsHandler();
      internals._fastL2RecoveryAttempts = 3;
      await internals._recoverFastL2('snapshot_timeout');
      expect(original.dispose).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the reconnect budget when blur lands during Fast L2 risk invalidation', async () => {
    const { service, internals, original } = createFastL2Recovery();
    const invalidate = Promise.withResolvers<void>();
    const setRiskInputs = jest
      .spyOn(perpsLiquidationRiskInputsAtom, 'set')
      .mockReturnValueOnce(invalidate.promise);
    internals._fastL2RecoveryAttempts = 3;
    const fastL2 = internals._recoverFastL2('snapshot_timeout');
    expect(setRiskInputs).toHaveBeenCalledTimes(1);
    await service.disableSubscriptionsHandler();
    await service.enableSubscriptionsHandler();
    invalidate.resolve();
    await fastL2;
    expect(original.dispose).not.toHaveBeenCalled();
    expect(internals._fastL2ReconnectAttempted).toBe(false);
    await internals._recoverFastL2('snapshot_timeout');
    expect(original.dispose).toHaveBeenCalledTimes(1);
    expect(internals._fastL2ReconnectAttempted).toBe(true);
  });

  it.each([false, true])(
    'shares one reconnect and retains the BBO fills gap when Fast L2 exhausts attempts (Fast L2 first: %s)',
    async (fastL2First) => {
      const { internals, original, replacement, user } = createFastL2Recovery();
      const invalidate = Promise.withResolvers<void>();
      jest
        .spyOn(perpsLiquidationRiskInputsAtom, 'set')
        .mockReturnValueOnce(invalidate.promise);
      const reconnect = jest.spyOn(internals, '_forceReconnectTransport');
      const recoverBbo = () =>
        internals._reconnectTransportSingleFlight({
          canReconnect: () => true,
          captureUserFills: true,
        });
      internals._fastL2RecoveryAttempts = 3;
      const recoverFastL2 = () => internals._recoverFastL2('snapshot_timeout');
      const work = fastL2First
        ? [recoverFastL2(), recoverBbo()]
        : [recoverBbo(), recoverFastL2()];
      await jest.advanceTimersByTimeAsync(0);
      invalidate.resolve();
      await Promise.all(work);

      expect(reconnect).toHaveBeenCalledTimes(1);
      expect(original.dispose).toHaveBeenCalledTimes(1);
      expect(replacement.dispose).not.toHaveBeenCalled();
      expect(internals._fastL2ReconnectAttempted).toBe(true);
      expect(internals._interruptedBboReconnectFills.has(user)).toBe(true);
    },
  );

  it('reconnects on a current Fast L2 unsubscribe failure and keeps fallback available', async () => {
    const { service, internals, original, unsubscribe, spec } =
      createFastL2Recovery();
    const reconnect = jest.spyOn(internals, '_forceReconnectTransport');
    const fastL2 = internals._recoverFastL2('snapshot_timeout');
    await jest.advanceTimersByTimeAsync(0);
    expect(original.unsubscribe).toHaveBeenCalledTimes(1);

    unsubscribe.reject(new Error('Request timed out after 5000 ms'));
    await fastL2;
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(original.dispose).toHaveBeenCalledTimes(1);
    expect(internals._interruptedBboReconnectFills.size).toBe(0);

    internals._fastL2RecoveryAttempts = 3;
    const update = jest
      .spyOn(service, 'updateSubscriptions')
      .mockResolvedValue(undefined);
    await internals._recoverFastL2('snapshot_timeout');
    expect(internals._fastL2FallbackTargetKey).toBe(spec.key);
    expect(update).toHaveBeenCalledTimes(1);
    expect(reconnect).toHaveBeenCalledTimes(1);
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
      loadTradesHistory: jest
        .fn<
          Promise<IFill[]>,
          Parameters<ServiceHyperliquid['loadTradesHistory']>
        >()
        .mockResolvedValue([]),
      appendTradesHistory: jest
        .fn<
          Promise<void>,
          Parameters<ServiceHyperliquid['appendTradesHistory']>
        >()
        .mockResolvedValue(undefined),
      mergeRecoveredTradesHistory: jest
        .fn<Promise<boolean>, [IFill[], string]>()
        .mockResolvedValue(true),
    };
    const service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquidCache: {
          flushPendingL2BookSnapshotCache: jest.fn(),
          cacheL2BookSnapshot: jest.fn(),
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

    jest.mocked(getCurrentVisibilityState).mockReset().mockReturnValue(true);
    jest.mocked(isAppVisible).mockReset().mockReturnValue(true);
    jest
      .mocked(onVisibilityStateChange)
      .mockReset()
      .mockReturnValue(() => {});
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

  it.each([
    ['unsubscribe timeout', 'while blurred'],
    ['unsubscribe timeout', 'already blurred'],
    ['unsubscribe timeout', 'during refocus'],
    ['unsubscribe timeout', 'after refocus'],
    ['unsubscribe timeout', 'with reconnect budget spent'],
    ['unsubscribe timeout', 'before forced rebuild'],
    ['exhausted retries', 'while blurred'],
    ['exhausted retries', 'already blurred'],
    ['exhausted retries', 'during refocus'],
    ['exhausted retries', 'snapshot on refocus'],
  ] as const)(
    'delivers a fresh same-coin book after Fast L2 %s %s',
    async (fault, timing) => {
      jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', false);
      const { service, internals, unsubscribe } = setupSwitch({
        activeSpecs: [allDexs, allMids],
      });
      const original = internals._client;
      const replacement = {
        ...original,
        subscribe: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
      };
      jest
        .spyOn(internals, 'getWebSocketClient')
        .mockImplementation(async () => {
          internals._client ??= replacement;
          return internals._client;
        });
      const book = service as unknown as {
        _fastL2RecoveryAttempts: number;
        _fastL2ReconnectAttempted: boolean;
        _fastL2FallbackTargetKey: string | null;
        _handleSubscriptionData: (
          type: ESubscriptionType,
          event: CustomEvent,
        ) => Promise<void>;
      };
      const receiveSnapshot = async (type = ESubscriptionType.L2) => {
        const emit = jest.spyOn(appEventBus, 'emit');
        const snapshot = {
          coin: 'ETH',
          time: Date.now(),
          levels: [
            [{ px: '100', sz: '1', n: 1 }],
            [{ px: '101', sz: '1', n: 1 }],
          ],
        };
        await book._handleSubscriptionData(
          type,
          new CustomEvent(type, {
            detail: type === newBook.type ? { s: snapshot } : snapshot,
          }),
        );
        expect(emit).toHaveBeenCalledWith(
          EAppEventBusNames.HyperliquidDataUpdate,
          expect.objectContaining({
            subType: ESubscriptionType.L2_BOOK,
            data: expect.objectContaining(snapshot),
          }),
        );
      };
      await service.updateSubscriptions();
      const useFallback = timing === 'with reconnect budget spent';
      const forceRebuild = timing === 'before forced rebuild';
      const fallback = {
        ...newBook,
        key: 'l2Book:ETH',
        type: ESubscriptionType.L2_BOOK as const,
        params: { coin: 'ETH' },
      };
      if (useFallback) book._fastL2ReconnectAttempted = true;
      const mutedBeforeTimeout = timing === 'already blurred';
      const blocked = Promise.withResolvers<void>();
      if (fault === 'exhausted retries') {
        const risk = jest
          .spyOn(perpsLiquidationRiskInputsAtom, 'set')
          .mockReturnValueOnce(blocked.promise);
        await jest.advanceTimersByTimeAsync(4000);
        internals._lastMessageAt = Date.now();
        await jest.advanceTimersByTimeAsync(11_000);
        if (mutedBeforeTimeout) {
          await service.disableSubscriptionsHandler();
        }
        await jest.advanceTimersByTimeAsync(1000);
        expect(risk).toHaveBeenCalledTimes(mutedBeforeTimeout ? 0 : 1);
        expect(original.subscribe).toHaveBeenCalledTimes(4);
      } else {
        unsubscribe.mockReturnValueOnce(blocked.promise);
        // A later recovery attempt waits before sending its unsubscribe.
        if (timing === 'after refocus') {
          book._fastL2RecoveryAttempts = 1;
        }
        if (mutedBeforeTimeout) {
          await service.disableSubscriptionsHandler();
        }
        await jest.advanceTimersByTimeAsync(3000);
      }
      internals._lastFrameAt = Date.now();
      internals._lastMessageAt = Date.now();
      if (!mutedBeforeTimeout) {
        await service.disableSubscriptionsHandler();
      }
      const refocus =
        timing === 'while blurred' ||
        mutedBeforeTimeout ||
        useFallback ||
        forceRebuild
          ? undefined
          : service.resumeSubscriptions();
      await jest.advanceTimersByTimeAsync(1000);
      expect(unsubscribe).toHaveBeenCalledWith(newBook.type, newBook.params);
      expect(original.dispose).not.toHaveBeenCalled();

      if (timing === 'snapshot on refocus') {
        await receiveSnapshot();
      }
      if (fault === 'exhausted retries') {
        blocked.resolve();
      } else {
        blocked.reject(new Error('Request timed out'));
      }
      await jest.advanceTimersByTimeAsync(0);
      if (!refocus) {
        expect(original.dispose).not.toHaveBeenCalled();
      }
      if (useFallback && book._fastL2FallbackTargetKey === newBook.key) {
        jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
          requiredSubSpecsMap: {
            [fallback.key]: fallback,
            [allDexs.key]: allDexs,
            [allMids.key]: allMids,
          },
          params: {
            ...internals._currentState,
            orderBookTransport: fallback.type,
          },
        });
      }
      const resumed = refocus ?? service.resumeSubscriptions({ forceRebuild });
      if (forceRebuild) await jest.advanceTimersByTimeAsync(100);
      await resumed;
      if (useFallback || forceRebuild) {
        expect(original.dispose).not.toHaveBeenCalled();
        const target = useFallback ? fallback : newBook;
        const subscriptions = original.subscribe.mock.calls.filter(
          ([type]) => type === target.type,
        );
        expect(subscriptions).toHaveLength(forceRebuild ? 2 : 1);
        expect(subscriptions.at(-1)).toEqual([target.type, target.params]);
        await receiveSnapshot(target.type);
        return;
      }
      if (timing === 'snapshot on refocus') {
        expect(original.dispose).not.toHaveBeenCalled();
        expect(book._fastL2ReconnectAttempted).toBe(false);
        return;
      }
      expect(original.dispose).toHaveBeenCalledTimes(1);
      expect(replacement.dispose).not.toHaveBeenCalled();
      expect(book._fastL2ReconnectAttempted).toBe(true);

      service.socketOpenHandler({
        target: replacement.transport.socket,
      } as unknown as WebSocketEventMap['open']);
      await jest.advanceTimersByTimeAsync(0);
      expect(replacement.subscribe).toHaveBeenCalledWith(
        newBook.type,
        newBook.params,
      );
      await receiveSnapshot();
    },
  );

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

  it.each(
    (
      [
        ESubscriptionType.ACTIVE_ASSET_DATA,
        ESubscriptionType.ACTIVE_ASSET_CTX,
      ] as const
    ).flatMap((type) =>
      (['acknowledged', 'timed out', 'timed out while blurred'] as const).map(
        (outcome) => ({ type, outcome }),
      ),
    ),
  )(
    'restores BTC $type after its unsubscribe is $outcome',
    async ({ type, outcome }) => {
      const user = '0x123';
      const assetSpec = (coin: string): ISubscriptionSpec<typeof type> => {
        const isAssetData = type === ESubscriptionType.ACTIVE_ASSET_DATA;
        const params = isAssetData ? ({ coin, user } as const) : { coin };
        return {
          type,
          params,
          key: generateSubscriptionKey(type, params),
          priority: isAssetData ? 3 : 2,
        };
      };
      const btc = assetSpec('BTC');
      const eth = assetSpec('ETH');
      const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
        key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, { user }),
        type: ESubscriptionType.USER_FILLS,
        params: { user },
        priority: 2,
      };
      const {
        service,
        internals,
        unsubscribe,
        activeSubscriptions,
        fillsHistory,
      } = setupSwitch({
        activeSpecs: [btc, allDexs, allMids, fills],
      });
      internals._currentState.currentUser = user;
      jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
        accountId: null,
        indexedAccountId: null,
        deriveType: 'default',
        accountAddress: user,
      });
      const original = internals._client;
      const replacement = {
        ...original,
        subscribe: jest
          .fn<Promise<void>, [ESubscriptionType, unknown]>()
          .mockResolvedValue(undefined),
      };
      jest
        .spyOn(internals, 'getWebSocketClient')
        .mockImplementation(async () => {
          internals._client ??= replacement;
          return internals._client;
        });
      const required = jest.spyOn(service, 'buildRequiredSubscriptionsMap');
      const select = (spec: ISubscriptionSpec<typeof type>) => {
        required.mockResolvedValue({
          requiredSubSpecsMap: {
            [spec.key]: spec,
            [allDexs.key]: allDexs,
            [allMids.key]: allMids,
            [fills.key]: fills,
          },
          params: {
            ...internals._currentState,
            currentSymbol: spec.params.coin,
          },
        });
      };
      const timedOut = outcome !== 'acknowledged';
      const blurred = outcome === 'timed out while blurred';
      unsubscribe.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              if (timedOut) {
                reject(new Error('Request timed out'));
                return;
              }
              resolve();
            }, 5000);
          }),
      );

      select(eth);
      const toEth = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      expect(unsubscribe).toHaveBeenCalledWith(btc.type, btc.params);
      if (blurred) {
        await service.disableSubscriptionsHandler();
      }
      select(btc);
      const toBtc = service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(5000);
      await Promise.all([toEth, toBtc]);

      if (blurred) {
        expect(original.dispose).not.toHaveBeenCalled();
        const resume = service.resumeSubscriptions();
        await jest.advanceTimersByTimeAsync(100);
        await resume;
      }
      if (timedOut) {
        // The transport mock does not dispatch an open event.
        await service.updateSubscriptions();
        expect(replacement.subscribe).toHaveBeenCalledWith(
          btc.type,
          btc.params,
        );
        expect(original.dispose).toHaveBeenCalledTimes(1);
      } else {
        expect(original.subscribe.mock.calls).toEqual([
          [eth.type, eth.params],
          [btc.type, btc.params],
        ]);
        expect(original.unsubscribe.mock.calls).toEqual([
          [btc.type, btc.params],
          [eth.type, eth.params],
        ]);
        expect(activeSubscriptions.get(btc.key)?.spec).toEqual(btc);
        expect(original.dispose).not.toHaveBeenCalled();
        expect(fillsHistory.loadTradesHistory).not.toHaveBeenCalled();
        expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
      }
    },
  );

  function setupBboUnsubscribeTimeout() {
    const user = '0x123' as const;
    jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
      accountAddress: user,
    });
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
    return { ...env, original, replacement, fills, oldBbo, targetBbo, user };
  }

  function setupTradesHistory(
    fillsHistory: ReturnType<typeof setupSwitch>['fillsHistory'],
  ): ServiceHyperliquid {
    const history = Object.create(
      ServiceHyperliquid.prototype,
    ) as ServiceHyperliquid;
    fillsHistory.loadTradesHistory.mockImplementation((address) =>
      history.loadTradesHistory(address),
    );
    fillsHistory.mergeRecoveredTradesHistory.mockImplementation(
      (rows, address) => history.mergeRecoveredTradesHistory(rows, address),
    );
    return history;
  }

  async function timeOutBboUnsubscribe(
    service: ServiceHyperliquidSubscription,
  ) {
    const switching = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(5000);
    await switching;
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

  it.each([false, true])(
    'keeps recovered fills when a history refresh commits (account switched: %s)',
    async (switched) => {
      const history = Object.create(
        ServiceHyperliquid.prototype,
      ) as ServiceHyperliquid;
      const user = '0x123';
      const currentUser = switched ? '0x456' : user;
      const existing = makeFill(1, 4900);
      const recovered = makeFill(2, 5100);
      Object.defineProperty(history, '_getUserFillsByTimeMemo', {
        value: { clear: jest.fn() },
      });
      jest.spyOn(history, 'getUserFillsByTime').mockResolvedValue([existing]);
      const previousAccount = await perpsActiveAccountAtom.get();
      const previousHistory = await perpsTradesHistoryDataAtom.get();
      const setHistory = perpsTradesHistoryDataAtom.set;
      try {
        await perpsActiveAccountAtom.set({
          ...previousAccount,
          accountAddress: user,
        });
        await setHistory({
          accountAddress: user,
          fills: [existing],
          isLoaded: true,
          latestTime: existing.time,
        });
        // Interleave a completed backfill (or switch) immediately before the REST write.
        jest
          .spyOn(perpsTradesHistoryDataAtom, 'set')
          .mockImplementationOnce(async (...args) => {
            if (switched) {
              await perpsActiveAccountAtom.set({
                ...previousAccount,
                accountAddress: currentUser,
              });
              await setHistory({
                accountAddress: currentUser,
                fills: [],
                isLoaded: true,
                latestTime: 0,
              });
            }
            await history.appendTradesHistory([recovered], currentUser);
            return setHistory(...args);
          });
        const result = await history.loadTradesHistory(user, { force: true });
        const expected = switched ? [recovered] : [recovered, existing];
        expect(await perpsTradesHistoryDataAtom.get()).toMatchObject({
          accountAddress: currentUser,
          fills: expected,
          latestTime: recovered.time,
        });
        expect(result).toEqual(switched ? [existing] : expected);
      } finally {
        await perpsActiveAccountAtom.set(previousAccount);
        await setHistory(previousHistory);
      }
    },
  );

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

  it('keeps fills on both sides of the backfill cutoff during the first history load', async () => {
    const bucketStart = new Date('2026-11-21T00:00:00.000Z').getTime();
    jest.setSystemTime(bucketStart + 3000);
    const previousAccount = await perpsActiveAccountAtom.get();
    const { service, fillsHistory, user } = setupBboUnsubscribeTimeout();
    const early = makeFill(1, bucketStart + 1000);
    const gap = makeFill(2, bucketStart + 7990);
    const duringLoad = makeFill(3, bucketStart + 8050);
    const afterCutoff = makeFill(4, bucketStart + 8150);
    let finishInitialLoad: (() => void) | undefined;
    const initialFetch = jest.fn<
      Promise<IFill[]>,
      [IUserFillsByTimeParameters]
    >(
      ({ endTime }) =>
        new Promise((resolve) => {
          finishInitialLoad = () =>
            resolve(
              [early, gap, duringLoad].filter(
                (fill) => fill.time <= Number(endTime),
              ),
            );
        }),
    );
    const history = setupTradesHistory(fillsHistory);
    Object.defineProperty(history, '_getUserFillsByTimeMemo', {
      value: initialFetch,
    });
    fillsHistory.getUserFillsByTime.mockImplementation(
      async ({ startTime, endTime }) =>
        [early, gap, duringLoad, afterCutoff].filter(
          (fill) =>
            Number(startTime) <= fill.time && fill.time <= Number(endTime),
        ),
    );
    const previous = await perpsTradesHistoryDataAtom.get();
    try {
      await perpsActiveAccountAtom.set({
        ...previousAccount,
        accountAddress: user,
      });
      await history.resetTradesHistory();
      await timeOutBboUnsubscribe(service);
      await service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(50);
      expect(finishInitialLoad).toBeDefined();
      await history.appendTradesHistory([duringLoad], user);
      expect((await perpsTradesHistoryDataAtom.get()).isLoaded).toBe(false);
      await jest.advanceTimersByTimeAsync(50);
      const cutoffAfterLoad = Date.now();
      finishInitialLoad?.();
      await jest.advanceTimersByTimeAsync(0);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledWith(
        expect.objectContaining({ endTime: cutoffAfterLoad }),
      );
      await jest.advanceTimersByTimeAsync(50);
      await history.appendTradesHistory([afterCutoff], user);

      expect(initialFetch).toHaveBeenCalledWith(
        expect.objectContaining({ endTime: bucketStart }),
      );
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
      await expect(history.loadTradesHistory(user)).resolves.toEqual([
        afterCutoff,
        duringLoad,
        gap,
        early,
      ]);
      expect(initialFetch).toHaveBeenCalledTimes(1);
    } finally {
      await perpsActiveAccountAtom.set(previousAccount);
      await perpsTradesHistoryDataAtom.set(previous);
    }
  });

  it('keeps a same-account gap fill returned during a full subscription rebuild', async () => {
    const previousAccount = await perpsActiveAccountAtom.get();
    const { service, fillsHistory, user } = setupBboUnsubscribeTimeout();
    const existing = makeFill(1, Date.now() - 5000);
    const recovered = makeFill(2, Date.now() + 5000);
    const history = setupTradesHistory(fillsHistory);
    let returnRecovery: ((fills: IFill[]) => void) | undefined;
    fillsHistory.getUserFillsByTime.mockImplementation(
      () =>
        new Promise<IFill[]>((resolve) => {
          returnRecovery = resolve;
        }),
    );
    const previous = await perpsTradesHistoryDataAtom.get();
    try {
      await perpsActiveAccountAtom.set({
        ...previousAccount,
        accountAddress: user,
      });
      await perpsTradesHistoryDataAtom.set({
        fills: [existing],
        isLoaded: true,
        accountAddress: user,
        latestTime: existing.time,
      });
      await timeOutBboUnsubscribe(service);
      await service.updateSubscriptions();
      expect(returnRecovery).toBeDefined();

      const rebuilding = service.resumeSubscriptions({ forceRebuild: true });
      await jest.advanceTimersByTimeAsync(0);
      expect(service.pendingSubSpecsMap).toEqual({});
      returnRecovery?.([recovered]);
      await jest.advanceTimersByTimeAsync(0);
      expect(service.pendingSubSpecsMap).toEqual({});
      await jest.advanceTimersByTimeAsync(50);
      await rebuilding;
      expect(Object.keys(service.pendingSubSpecsMap).length).toBeGreaterThan(0);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);

      await expect(history.loadTradesHistory(user)).resolves.toEqual([
        recovered,
        existing,
      ]);
    } finally {
      await perpsActiveAccountAtom.set(previousAccount);
      await perpsTradesHistoryDataAtom.set(previous);
    }
  });

  it.each([false, true])(
    'bounds foreground fills backfill retries after a REST failure (permanent failure: %s)',
    async (permanentFailure) => {
      const { service, fillsHistory, user } = setupBboUnsubscribeTimeout();
      const recovered = makeFill(2, Date.now() + 5000);
      const failure = new Error('REST unavailable');
      fillsHistory.getUserFillsByTime.mockRejectedValueOnce(failure);
      if (permanentFailure) {
        fillsHistory.getUserFillsByTime.mockRejectedValue(failure);
      } else {
        fillsHistory.getUserFillsByTime.mockResolvedValue([recovered]);
      }

      await timeOutBboUnsubscribe(service);
      await service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(3000);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(
        permanentFailure ? 3 : 2,
      );
      const starts = fillsHistory.getUserFillsByTime.mock.calls.map(
        ([params]) => params.startTime,
      );
      expect(new Set(starts).size).toBe(1);
      if (permanentFailure) {
        expect(fillsHistory.mergeRecoveredTradesHistory).not.toHaveBeenCalled();
      } else {
        expect(fillsHistory.mergeRecoveredTradesHistory).toHaveBeenCalledWith(
          [recovered],
          user,
        );
      }
    },
  );

  it('recovers the original account gap after another account subscribes', async () => {
    const { service, fillsHistory, internals, replacement, targetBbo, user } =
      setupBboUnsubscribeTimeout();
    const recovered = makeFill(2, Date.now() + 5000);
    fillsHistory.getUserFillsByTime.mockResolvedValue([recovered]);
    const switchAccount = async (accountAddress: '0x123' | '0x456') => {
      jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
        ...(await perpsActiveAccountAtom.get()),
        accountAddress,
      });
      const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
        key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, {
          user: accountAddress,
        }),
        type: ESubscriptionType.USER_FILLS,
        params: { user: accountAddress },
        priority: 2,
      };
      jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
        requiredSubSpecsMap: Object.fromEntries(
          [targetBbo, fills, allDexs, allMids].map((spec) => [spec.key, spec]),
        ),
        params: { ...internals._currentState, currentUser: accountAddress },
      });
      await service.updateSubscriptions();
    };

    await timeOutBboUnsubscribe(service);
    await switchAccount('0x456');
    expect(replacement.subscribe).toHaveBeenCalledWith(
      ESubscriptionType.USER_FILLS,
      { user: '0x456' },
    );
    expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();

    await switchAccount(user);
    await jest.advanceTimersByTimeAsync(0);
    expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
    expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledWith(
      expect.objectContaining({ user }),
    );
    expect(fillsHistory.mergeRecoveredTradesHistory).toHaveBeenCalledWith(
      [recovered],
      user,
    );
  });

  it.each(['while merging', 'during REST'] as const)(
    'keeps the original gap when history changes account %s',
    async (switchTime) => {
      const getAccount = perpsActiveAccountAtom.get;
      const previousAccount = await getAccount();
      const setHistory = perpsTradesHistoryDataAtom.set;
      const previousHistory = await perpsTradesHistoryDataAtom.get();
      const { service, fillsHistory, internals, targetBbo, user } =
        setupBboUnsubscribeTimeout();
      jest.spyOn(perpsActiveAccountAtom, 'get').mockImplementation(getAccount);
      const otherUser = '0x456';
      const timestamp = Date.now();
      const existing = makeFill(1, timestamp - 5000);
      const recovered = makeFill(2, timestamp + 5000);
      const otherFill = makeFill(3, timestamp + 5050);
      const history = setupTradesHistory(fillsHistory);
      Object.defineProperty(history, '_getUserFillsByTimeMemo', {
        value: jest.fn().mockResolvedValue([existing]),
      });
      fillsHistory.getUserFillsByTime.mockResolvedValue([recovered]);
      let release: (() => void) | undefined;
      const selectAccount = async (
        accountAddress: typeof user | typeof otherUser,
      ) => {
        await perpsActiveAccountAtom.set({
          ...previousAccount,
          accountAddress,
        });
        const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
          key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, {
            user: accountAddress,
          }),
          type: ESubscriptionType.USER_FILLS,
          params: { user: accountAddress },
          priority: 2,
        };
        jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
          requiredSubSpecsMap: Object.fromEntries(
            [targetBbo, fills, allDexs, allMids].map((spec) => [
              spec.key,
              spec,
            ]),
          ),
          params: { ...internals._currentState, currentUser: accountAddress },
        });
        await service.updateSubscriptions();
      };

      try {
        await perpsActiveAccountAtom.set({
          ...previousAccount,
          accountAddress: user,
        });
        await setHistory({
          accountAddress: user,
          isLoaded: true,
          latestTime: existing.time,
          fills: [existing],
        });
        if (switchTime === 'while merging') {
          jest
            .spyOn(perpsTradesHistoryDataAtom, 'set')
            .mockImplementationOnce(async (...args) => {
              await new Promise<void>((resolve) => {
                release = resolve;
              });
              return setHistory(...args);
            });
        } else {
          fillsHistory.getUserFillsByTime.mockImplementationOnce(async () => {
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            return [recovered];
          });
        }
        await timeOutBboUnsubscribe(service);
        await service.updateSubscriptions();
        await jest.advanceTimersByTimeAsync(0);
        expect(release).toBeDefined();

        await selectAccount(otherUser);
        await setHistory({
          accountAddress: otherUser,
          isLoaded: true,
          latestTime: otherFill.time,
          fills: [otherFill],
        });
        if (switchTime === 'during REST') {
          await selectAccount(user);
        }
        release?.();
        await jest.advanceTimersByTimeAsync(0);
        expect(await perpsTradesHistoryDataAtom.get()).toMatchObject({
          accountAddress: otherUser,
          fills: [otherFill],
        });
        if (switchTime === 'while merging') {
          await selectAccount(user);
        }
        await jest.advanceTimersByTimeAsync(3000);
        expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(2);
        expect(await history.loadTradesHistory(user)).toEqual([
          recovered,
          existing,
        ]);
      } finally {
        await perpsActiveAccountAtom.set(previousAccount);
        await setHistory(previousHistory);
      }
    },
  );

  it('keeps a newer gap when an older account recovery finishes', async () => {
    const {
      service,
      internals,
      fillsHistory,
      replacement,
      fills,
      oldBbo,
      user,
    } = setupBboUnsubscribeTimeout();
    const firstFill = makeFill(2, Date.now() + 5000);
    const secondFill = makeFill(3, Date.now() + 10_000);
    let finishFirst: ((rows: IFill[]) => void) | undefined;
    fillsHistory.getUserFillsByTime.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    fillsHistory.getUserFillsByTime.mockResolvedValue([secondFill]);

    const firstSwitch = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(5000);
    await firstSwitch;
    await service.updateSubscriptions();
    expect(finishFirst).toBeDefined();

    replacement.unsubscribe.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), 5000);
        }),
    );
    internals._lastMessageAt = Date.now();
    jest.spyOn(service, 'buildRequiredSubscriptionsMap').mockResolvedValue({
      requiredSubSpecsMap: Object.fromEntries(
        [oldBbo, fills, allDexs, allMids].map((spec) => [spec.key, spec]),
      ),
      params: { ...internals._currentState, currentSymbol: 'BTC' },
    });
    const secondSwitch = service.updateSubscriptions();
    await jest.advanceTimersByTimeAsync(5000);
    await secondSwitch;
    await service.updateSubscriptions();
    expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);

    finishFirst?.([firstFill]);
    await jest.advanceTimersByTimeAsync(0);
    expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(2);
    expect(fillsHistory.getUserFillsByTime.mock.calls[1][0].startTime).toBe(
      fillsHistory.getUserFillsByTime.mock.calls[0][0].startTime,
    );
    expect(fillsHistory.mergeRecoveredTradesHistory.mock.calls).toEqual([
      [[firstFill], user],
      [[secondFill], user],
    ]);
  });

  it.each([
    ['window refocus', false, undefined],
    ['Perps route resume', true, undefined],
    ['desktop fullscreen while focused', false, true],
    ['desktop fullscreen after blur', false, false],
  ] as const)(
    'backfills once on %s',
    async (_scenario, routePaused, focusedAtAck) => {
      const isDesktop = focusedAtAck !== undefined;
      if (isDesktop) {
        jest.replaceProperty(platformEnv, 'isDesktop', true);
        jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', false);
      }
      const focus = jest.mocked(getCurrentVisibilityState);
      const previousAccount = await perpsActiveAccountAtom.get();
      const previousHistory = await perpsTradesHistoryDataAtom.get();
      const { service, fillsHistory, replacement, user } =
        setupBboUnsubscribeTimeout();
      const history = setupTradesHistory(fillsHistory);
      const existing = makeFill(1, Date.now() - 5000);
      const recovered = makeFill(2, Date.now() + 5000);
      fillsHistory.getUserFillsByTime.mockResolvedValue([recovered]);
      const refresh = jest.spyOn(perpsTradesHistoryRefreshHookAtom, 'set');
      const visible = jest.mocked(isAppVisible).mockReturnValue(true);
      const stop = jest.fn();
      const watch = jest.mocked(onVisibilityStateChange).mockReturnValue(stop);

      try {
        await perpsActiveAccountAtom.set({
          ...previousAccount,
          accountAddress: user,
        });
        await perpsTradesHistoryDataAtom.set({
          accountAddress: user,
          isLoaded: true,
          latestTime: existing.time,
          fills: [existing],
        });
        await timeOutBboUnsubscribe(service);
        expect(focus).not.toHaveBeenCalled();
        visible.mockReturnValue(false);
        focus.mockReturnValue(focusedAtAck ?? true);
        await service.updateSubscriptions();
        await jest.advanceTimersByTimeAsync(0);
        const expectedListeners = focusedAtAck === true ? 0 : 1;
        expect(watch).toHaveBeenCalledTimes(expectedListeners);
        const onVisibility = watch.mock.calls[0]?.[0];
        if (onVisibility) {
          onVisibility(false);
          await jest.advanceTimersByTimeAsync(0);
          expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
        }

        if (routePaused) {
          await service.disableSubscriptionsHandler();
        }
        const wireSubscriptions = replacement.subscribe.mock.calls.length;
        visible.mockReturnValue(!isDesktop);
        focus.mockReturnValue(true);
        onVisibility?.(!isDesktop);
        onVisibility?.(!isDesktop);
        if (routePaused) {
          await jest.advanceTimersByTimeAsync(0);
          expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
          await service.enableSubscriptionsHandler();
        }
        await jest.advanceTimersByTimeAsync(0);
        onVisibility?.(!isDesktop);
        expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
        expect(await history.loadTradesHistory(user)).toEqual([
          recovered,
          existing,
        ]);
        expect(replacement.subscribe).toHaveBeenCalledTimes(wireSubscriptions);
        expect(refresh).not.toHaveBeenCalled();
        expect(stop).toHaveBeenCalledTimes(expectedListeners);
      } finally {
        await perpsActiveAccountAtom.set(previousAccount);
        await perpsTradesHistoryDataAtom.set(previousHistory);
      }
    },
  );

  it.each(['account', 'socket'] as const)(
    'discards a hidden fills callback after the %s changes',
    async (changed) => {
      const { service, fillsHistory, internals, replacement, user } =
        setupBboUnsubscribeTimeout();
      const visible = jest.mocked(isAppVisible).mockReturnValue(true);
      const stop = jest.fn();
      let onVisibility: ((visible: boolean) => void) | undefined;
      jest.mocked(onVisibilityStateChange).mockImplementation((callback) => {
        onVisibility = callback;
        return stop;
      });
      await timeOutBboUnsubscribe(service);
      visible.mockReturnValue(false);
      await service.updateSubscriptions();
      await jest.advanceTimersByTimeAsync(0);
      expect(onVisibility).toBeDefined();

      if (changed === 'account') {
        jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
          ...(await perpsActiveAccountAtom.get()),
          accountAddress: '0x456',
        });
      } else {
        const { socket } = replacement.transport;
        Object.assign(socket, { readyState: WebSocket.CLOSED });
        service.socketCloseHandler({
          target: socket,
        } as unknown as WebSocketEventMap['close']);
        Object.assign(socket, { readyState: WebSocket.OPEN });
        internals._socketOpenedAt = Date.now();
      }
      const wireSubscriptions = replacement.subscribe.mock.calls.length;
      visible.mockReturnValue(true);
      onVisibility?.(true);
      await jest.advanceTimersByTimeAsync(0);
      expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
      expect(replacement.subscribe).toHaveBeenCalledTimes(wireSubscriptions);
      expect(stop).toHaveBeenCalledTimes(1);

      if (changed === 'socket') {
        const reopen = service.updateSubscriptions();
        await jest.advanceTimersByTimeAsync(500);
        await reopen;
        expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
        expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledWith(
          expect.objectContaining({ user }),
        );
      }
    },
  );

  it('does not backfill user fills when the BBO unsubscribe succeeds', async () => {
    const { service, unsubscribe, fillsHistory } = setupBboUnsubscribeTimeout();
    unsubscribe.mockReset().mockResolvedValue(undefined);
    await service.updateSubscriptions();
    expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();
    expect(onVisibilityStateChange).not.toHaveBeenCalled();
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
      await timeOutBboUnsubscribe(service);
      expect(original.dispose).toHaveBeenCalledTimes(1);
      await service.resumeSubscriptions();
      expect(fillsHistory.getUserFillsByTime).not.toHaveBeenCalled();

      if (changedAccount) {
        const user = '0x456';
        jest.spyOn(perpsActiveAccountAtom, 'get').mockResolvedValue({
          ...(await perpsActiveAccountAtom.get()),
          accountAddress: user,
        });
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
        expect(fillsHistory.mergeRecoveredTradesHistory).not.toHaveBeenCalled();
        return;
      }
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledTimes(1);
      expect(fillsHistory.getUserFillsByTime).toHaveBeenCalledWith({
        user: fills.params.user,
        startTime: disconnectAt - 10_000,
        endTime: Date.now(),
        reversed: true,
      });
      expect(fillsHistory.mergeRecoveredTradesHistory).toHaveBeenCalledWith(
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

  it.each([
    'live',
    'disabled again',
    'blurred during plan read',
    'refocused during plan read',
    'blurred while clearing risk inputs',
    'closed',
    'already rebuilding',
  ] as const)(
    'handles concurrent forced resumes during a book ACK when %s',
    async (state) => {
      const user = '0x123';
      const fills: ISubscriptionSpec<ESubscriptionType.USER_FILLS> = {
        type: ESubscriptionType.USER_FILLS,
        params: { user },
        key: generateSubscriptionKey(ESubscriptionType.USER_FILLS, { user }),
        priority: 2,
      };
      const {
        activeSubscriptions,
        internals,
        service,
        subscribe,
        unsubscribe,
      } = setupSwitch({ activeSpecs: [oldBook, allDexs, allMids, fills] });
      internals._currentState.currentUser = user;
      const planFor = (book: typeof newBook) => ({
        requiredSubSpecsMap: {
          [book.key]: book,
          [allDexs.key]: allDexs,
          [allMids.key]: allMids,
          [fills.key]: fills,
        },
        params: {
          ...internals._currentState,
          currentSymbol: book.params.c,
        },
      });
      const readPlan = jest
        .spyOn(service, 'buildRequiredSubscriptionsMap')
        .mockResolvedValue(planFor(newBook));
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
      const latestPlan = planFor(latestBook);
      readPlan.mockResolvedValue(latestPlan);
      if (
        state === 'blurred during plan read' ||
        state === 'refocused during plan read'
      ) {
        readPlan.mockImplementationOnce(async () => {
          await service.disableSubscriptionsHandler();
          if (state === 'refocused during plan read') {
            await service.enableSubscriptionsHandler();
          }
          return latestPlan;
        });
      } else if (state === 'blurred while clearing risk inputs') {
        const setRiskInputs = perpsLiquidationRiskInputsAtom.set;
        jest
          .spyOn(perpsLiquidationRiskInputsAtom, 'set')
          .mockImplementationOnce(async (...args) => {
            await setRiskInputs(...args);
            await service.disableSubscriptionsHandler();
          });
      }
      acknowledgeBook?.();
      await jest.advanceTimersByTimeAsync(100);
      await Promise.all([recovery, force, secondForce]);

      const rebuilds =
        state === 'live' || state === 'already rebuilding' ? 1 : 0;
      for (const type of [fills.type, allMids.type]) {
        expect(
          unsubscribe.mock.calls.filter(([removed]) => removed === type),
        ).toHaveLength(rebuilds);
      }
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
