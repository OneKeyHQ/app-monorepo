import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { HYPERLIQUID_NETWORK_OFFLINE_GRACE_MS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsNetworkStatusAtom,
} from '../../states/jotai/atoms/perps';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import { generateSubscriptionKey } from './utils/SubscriptionConfig';

import type { ISubscriptionSpec } from './utils/SubscriptionConfig';
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

function createService() {
  return new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  });
}

describe('spot context price ownership', () => {
  const spec: ISubscriptionSpec<ESubscriptionType.SPOT_ASSET_CTXS> = {
    type: ESubscriptionType.SPOT_ASSET_CTXS,
    key: generateSubscriptionKey(ESubscriptionType.SPOT_ASSET_CTXS, {}),
    params: {},
    priority: 2,
  };
  const ctx = { coin: '@241', markPx: '0.0014' };
  let service: ServiceHyperliquidSubscription;
  let prices: {
    extractSpotPricesFromAllMids: jest.Mock;
    updateSpotAssetCtxsMap: jest.Mock;
    recalculateSpotTotalUsd: jest.Mock;
  };
  let internals: {
    _activeSubscriptions: Map<
      string,
      {
        key: string;
        type: ESubscriptionType;
        spec: typeof spec;
        createdAt: number;
        lastActivity: number;
        isActive: boolean;
      }
    >;
    _handleSubscriptionData: (
      type: ESubscriptionType,
      event: CustomEvent,
    ) => Promise<void>;
    _destroySubscription: (value: typeof spec) => Promise<boolean>;
    getWebSocketClient: () => Promise<{ unsubscribe: () => Promise<void> }>;
    _updateNetworkLiveness: () => void;
    _emitHyperliquidDataUpdate: () => void;
  };
  const subscribe = () => {
    service.allSubSpecsMap[spec.key] = spec;
    internals._activeSubscriptions.set(spec.key, {
      key: spec.key,
      type: spec.type,
      spec,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
    });
  };
  const receive = (type: ESubscriptionType, detail: unknown) =>
    internals._handleSubscriptionData(type, { detail } as CustomEvent);
  const receiveMids = () =>
    receive(ESubscriptionType.ALL_MIDS, { mids: { '@241': '0.002' } });

  beforeEach(() => {
    jest.useFakeTimers();
    prices = {
      extractSpotPricesFromAllMids: jest.fn(),
      updateSpotAssetCtxsMap: jest.fn(),
      recalculateSpotTotalUsd: jest.fn(),
    };
    service = new ServiceHyperliquidSubscription({
      backgroundApi: {
        serviceHyperliquid: prices,
      } as unknown as IBackgroundApi,
    });
    internals = service as unknown as typeof internals;
    jest
      .spyOn(internals, '_updateNetworkLiveness')
      .mockImplementation(() => {});
    jest
      .spyOn(internals, '_emitHyperliquidDataUpdate')
      .mockImplementation(() => {});
    jest.spyOn(internals, 'getWebSocketClient').mockResolvedValue({
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    });
    subscribe();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('owns only valid context coins after their first frame, without requiring prevDayPx', async () => {
    await receiveMids();
    expect(prices.extractSpotPricesFromAllMids).toHaveBeenLastCalledWith(
      { '@241': '0.002' },
      undefined,
    );
    await receive(ESubscriptionType.SPOT_ASSET_CTXS, [
      ctx,
      { coin: '@242', markPx: '' },
    ]);
    await receiveMids();
    expect(prices.extractSpotPricesFromAllMids).toHaveBeenLastCalledWith(
      { '@241': '0.002' },
      new Set(['@241']),
    );
  });

  it.each(['unsubscribe', 'close'] as const)(
    'drops ownership on %s and waits for the new subscription frame',
    async (action) => {
      await receive(ESubscriptionType.SPOT_ASSET_CTXS, [ctx]);
      if (action === 'unsubscribe') {
        await internals._destroySubscription(spec);
      } else {
        service.socketCloseHandler({
          target: { readyState: 3 },
        } as unknown as WebSocketEventMap['close']);
      }
      prices.updateSpotAssetCtxsMap.mockClear();
      await receive(ESubscriptionType.SPOT_ASSET_CTXS, [ctx]);
      expect(prices.updateSpotAssetCtxsMap).not.toHaveBeenCalled();
      await receiveMids();
      expect(prices.extractSpotPricesFromAllMids).toHaveBeenLastCalledWith(
        { '@241': '0.002' },
        undefined,
      );
      subscribe();
      await receiveMids();
      expect(prices.extractSpotPricesFromAllMids).toHaveBeenLastCalledWith(
        { '@241': '0.002' },
        undefined,
      );
      await receive(ESubscriptionType.SPOT_ASSET_CTXS, [ctx]);
      await receiveMids();
      expect(prices.extractSpotPricesFromAllMids).toHaveBeenLastCalledWith(
        { '@241': '0.002' },
        new Set(['@241']),
      );
    },
  );
});

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
