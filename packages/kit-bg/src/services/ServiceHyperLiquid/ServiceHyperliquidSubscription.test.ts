import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
    expect(internals._fundedActivationRefreshPendingAddress).toBe(
      accountAddress,
    );

    await jest.advanceTimersByTimeAsync(250);

    expect(startStatusCheck).toHaveBeenCalledTimes(2);
    expect(internals._fundedActivationRefreshPendingAddress).toBeNull();
    expect(internals._fundedActivationConfirmedAddress).toBe(accountAddress);
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
