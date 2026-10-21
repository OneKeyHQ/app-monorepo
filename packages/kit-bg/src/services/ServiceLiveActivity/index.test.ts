import ServiceLiveActivity from '.';

import liveActivity from '@onekeyhq/shared/src/modules/LiveActivity';
import { buildLiveActivityPushContent } from '@onekeyhq/shared/src/utils/liveActivityUtils';
import type { ILiveActivitySystemStatus } from '@onekeyhq/shared/types/liveActivity';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { pendingServerSubscriptionTransport } from './subscriptionTransport';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@onekeyhq/shared/src/platformEnv').default,
    isNativeIOS: true,
  },
}));

function createHistory(): ISwapTxHistory {
  const token = {
    networkId: 'btc--0',
    contractAddress: '',
    decimals: 8,
    symbol: 'BTC',
    isNative: true,
  };
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: { networkId: 'btc--0' },
      receiver: { networkId: 'evm--1' },
    },
    baseInfo: {
      fromToken: token,
      toToken: {
        ...token,
        networkId: 'evm--1',
        symbol: 'USDC',
        isNative: false,
      },
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: 'deposit-a',
      sender: 'synthetic-sender',
      receiver: 'synthetic-receiver',
    },
    swapInfo: {
      provider: { provider: 'mock', providerName: 'Mock' },
      instantRate: '1',
      orderId: 'synthetic-order',
    },
    date: { created: Date.now(), updated: Date.now() },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Live Activity subscription lifecycle', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let status: ILiveActivitySystemStatus;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    status = { supported: true, enabled: true, activities: [] };
    jest.spyOn(liveActivity, 'start').mockImplementation(async (snapshot) => {
      status.activities = [
        {
          ...snapshot,
          content: buildLiveActivityPushContent(
            snapshot.order,
            snapshot.content,
            Date.now(),
          ),
          activityId: 'synthetic-activity',
          activityState: 'active',
          pushRegistration: 'pending',
        },
      ];
      return status;
    });
    jest.spyOn(liveActivity, 'update').mockImplementation(async (snapshot) => {
      const current = status.activities[0];
      if (current)
        current.content = buildLiveActivityPushContent(
          snapshot.order,
          snapshot.content,
          Date.now(),
        );
      return status;
    });
    jest
      .spyOn(liveActivity, 'getStatus')
      .mockImplementation(async () => status);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not reject the broadcast owner when native creation fails', async () => {
    jest
      .mocked(liveActivity.start)
      .mockRejectedValue(new Error('Synthetic native failure'));
    const subscribe = jest.spyOn(
      pendingServerSubscriptionTransport,
      'subscribe',
    );
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await expect(
      service.onSwapBroadcast(createHistory()),
    ).resolves.toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when native Live Activities are disabled', async () => {
    jest
      .mocked(liveActivity.start)
      .mockResolvedValue({ supported: true, enabled: false, activities: [] });
    const subscribe = jest.spyOn(
      pendingServerSubscriptionTransport,
      'subscribe',
    );
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    expect(subscribe).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'upserts the terminal replacement deposit after in-flight registration (previous failure: %s)',
    async (previousFailure) => {
      const first = deferred<{ status: 'registered'; revision: number }>();
      const started = deferred<void>();
      const updated = deferred<void>();
      const subscribe = jest
        .spyOn(pendingServerSubscriptionTransport, 'subscribe')
        .mockImplementationOnce(() => {
          started.resolve();
          return first.promise;
        })
        .mockResolvedValue({ status: 'registered', revision: 2 });
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      const history = createHistory();
      const broadcast = service.onSwapBroadcast(history);
      await started.promise;
      jest
        .spyOn(liveActivity, 'update')
        .mockImplementation(async (snapshot) => {
          const current = status.activities[0];
          if (current) {
            current.content = buildLiveActivityPushContent(
              snapshot.order,
              snapshot.content,
              Date.now(),
            );
          }
          updated.resolve();
          return status;
        });
      const terminal = service.onSwapStatus({
        history: {
          ...history,
          txInfo: { ...history.txInfo, txId: 'deposit-b' },
        },
        status: { state: ESwapTxHistoryStatus.SUCCESS },
      });
      await updated.promise;
      if (previousFailure) {
        first.reject(new Error('Synthetic subscription failure'));
      } else {
        first.resolve({ status: 'registered', revision: 1 });
      }
      await Promise.all([broadcast, terminal]);
      expect(
        subscribe.mock.calls.map(
          ([request]) => request.tracking?.currentDepositTxId,
        ),
      ).toEqual(['deposit-a', 'deposit-b']);
      expect((await service.getStatus()).subscriptions[0]?.depositTxId).toBe(
        'deposit-b',
      );
    },
  );

  it('unsubscribes once when dismissed while registration is in flight', async () => {
    const first = deferred<{ status: 'registered'; revision: number }>();
    const started = deferred<void>();
    jest
      .spyOn(pendingServerSubscriptionTransport, 'subscribe')
      .mockImplementation(() => {
        started.resolve();
        return first.promise;
      });
    const unsubscribe = jest
      .spyOn(pendingServerSubscriptionTransport, 'unsubscribe')
      .mockResolvedValue(undefined);
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcast = service.onSwapBroadcast(createHistory());
    await started.promise;
    status.activities = [];
    first.resolve({ status: 'registered', revision: 1 });
    await broadcast;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledWith({
      activityId: 'synthetic-activity',
      orderKey: 'swap:synthetic-order',
      reason: 'dismissed',
    });
    expect((await service.getStatus()).subscriptions).toEqual([]);
  });

  it.each(['dismissed', 'terminal', 'expired'] as const)(
    'reports %s when the native activity disappears',
    async (reason) => {
      jest
        .spyOn(pendingServerSubscriptionTransport, 'subscribe')
        .mockResolvedValue({ status: 'registered', revision: 1 });
      const unsubscribe = jest
        .spyOn(pendingServerSubscriptionTransport, 'unsubscribe')
        .mockResolvedValue(undefined);
      const service = new ServiceLiveActivity({ backgroundApi: {} });
      const history = createHistory();
      if (reason === 'expired')
        history.date.created = Date.now() - 9 * 60 * 60 * 1000;
      await service.onSwapBroadcast(history);
      if (reason === 'terminal') {
        await service.onSwapStatus({
          history,
          status: { state: ESwapTxHistoryStatus.SUCCESS },
        });
      }
      status.activities = [];
      await service.getStatus();
      expect(unsubscribe).toHaveBeenCalledWith(
        expect.objectContaining({ reason }),
      );
    },
  );
});
