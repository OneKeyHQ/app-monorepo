import ServiceLiveActivity from '.';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';
import zhMessages from '@onekeyhq/shared/src/locale/json/zh_CN.json';
import liveActivity from '@onekeyhq/shared/src/modules/LiveActivity';
import { buildLiveActivityPushContent } from '@onekeyhq/shared/src/utils/liveActivityUtils';
import type { ILiveActivitySystemStatus } from '@onekeyhq/shared/types/liveActivity';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { createLazyServiceProxy } from '../../apis/lazyServiceProxy';
import { inAppNotificationAtom } from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';
import ServiceSwap from '../ServiceSwap';

import { clearReplacementGuards } from './replacementGuard';
import {
  liveActivityRemoteTracking,
  pendingServerSubscriptionTransport,
} from './subscriptionTransport';

const englishMessages: Record<string, string> = enMessages;
const chineseMessages: Record<string, string> = zhMessages;

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
    globalJotaiStorageReadyHandler.resolveReady(true);
    appLocale.setLocale('en-US', englishMessages);
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  beforeEach(() => {
    clearReplacementGuards();
    appLocale.setLocale('en-US', englishMessages);
    jest.spyOn(liveActivityRemoteTracking, 'isReady').mockReturnValue(true);
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
    jest
      .spyOn(liveActivity, 'clearTracking')
      .mockImplementation(async () => status);
  });

  it('does not create a real activity before remote tracking is available', async () => {
    jest.mocked(liveActivityRemoteTracking.isReady).mockReturnValue(false);
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    expect(liveActivity.start).not.toHaveBeenCalled();
  });

  it('marks legacy activities as needing ownership confirmation after service restart', async () => {
    const first = new ServiceLiveActivity({ backgroundApi: {} });
    await first.onSwapBroadcast(createHistory());
    const restarted = new ServiceLiveActivity({ backgroundApi: {} });
    expect((await restarted.getStatus()).activities[0].ownershipStatus).toBe(
      'needsConfirmation',
    );
    expect(status.activities).toHaveLength(1);
  });

  it('refreshes an existing activity in the App language without changing its business revision', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await service.onSwapBroadcast(createHistory());
    const previous = status.activities[0].content;
    const updateStrings = jest
      .spyOn(liveActivity, 'updateStrings')
      .mockResolvedValue(status);
    appLocale.setLocale('zh-CN', chineseMessages);
    await service.refreshLanguage();
    expect(updateStrings).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: previous.revision,
        strings: expect.objectContaining({ done: '完成' }),
      }),
    );
    expect(liveActivity.update).not.toHaveBeenCalled();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gives successive status updates distinct revisions in the same millisecond', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    await service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    const revisions = jest
      .mocked(liveActivity.update)
      .mock.calls.map(([snapshot]) => snapshot.content.revision);
    expect(revisions[1]).toBeGreaterThan(revisions[0]);
  });

  it('waits for activity creation before publishing a status for the same order', async () => {
    const creation = deferred<ILiveActivitySystemStatus>();
    const started = deferred<void>();
    jest.mocked(liveActivity.start).mockImplementation(async (snapshot) => {
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
          pushRegistration: 'notRequested',
        },
      ];
      started.resolve();
      return creation.promise;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    const broadcast = service.onSwapBroadcast(history);
    await started.promise;
    const update = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await Promise.resolve();
    expect(liveActivity.update).not.toHaveBeenCalled();
    creation.resolve(status);
    await Promise.all([broadcast, update]);
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(status.activities[0]?.content.status).toBe('done');
  });

  it('drains an in-flight native update, drops queued old states, and closes the replaced order', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    const started = deferred<void>();
    const complete = deferred<ILiveActivitySystemStatus>();
    jest.mocked(liveActivity.update).mockImplementationOnce(async () => {
      started.resolve();
      return complete.promise;
    });
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const first = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await started.promise;
    const second = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    const third = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.FAILED },
    });
    await Promise.resolve();
    await service.onSwapDepositReplaced({ oldTxId: 'deposit-a' });
    expect(end).not.toHaveBeenCalled();
    complete.resolve(status);
    await Promise.all([first, second, third]);
    await service.stopForPrivacyTransition();
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
    expect(status.activities).toEqual([]);
  });

  it('invalidates queued updates before a delayed real lazy-service proxy can notify the coordinator', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
    const loader = deferred<ServiceLiveActivity>();
    const proxy = createLazyServiceProxy({
      serviceName: 'ServiceLiveActivity',
      loader: () => loader.promise,
    });
    const swap = new ServiceSwap({
      backgroundApi: { serviceLiveActivity: proxy },
    });
    const started = deferred<void>();
    const complete = deferred<ILiveActivitySystemStatus>();
    jest.mocked(liveActivity.update).mockImplementationOnce(async () => {
      started.resolve();
      return complete.promise;
    });
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const first = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await started.promise;
    const queued = service.onSwapStatus({
      history,
      status: { state: ESwapTxHistoryStatus.FAILED },
    });
    await Promise.resolve();
    const replacement = swap.updateSwapHistoryTx({
      oldTxId: 'deposit-a',
      newTxId: 'deposit-b',
      status: ESwapTxHistoryStatus.PENDING,
    });
    complete.resolve(status);
    await Promise.all([first, queued, replacement]);
    expect(liveActivity.update).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
    loader.resolve(service);
    await proxy.onSwapDepositReplaced({ oldTxId: 'deposit-a' });
    await service.stopForPrivacyTransition();
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
  });

  it('blocks later replacement generations and cannot recreate the ended activity', async () => {
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const history = createHistory();
    await service.onSwapBroadcast(history);
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const orderKey = 'swap:synthetic-order';
    await service.onSwapDepositReplaced({ oldTxId: 'deposit-a', orderKey });
    await service.onSwapDepositReplaced({ oldTxId: 'deposit-b', orderKey });
    const second = {
      ...history,
      txInfo: { ...history.txInfo, txId: 'deposit-b' },
    };
    const third = {
      ...history,
      txInfo: { ...history.txInfo, txId: 'deposit-c' },
    };
    await service.onSwapStatus({
      history: second,
      status: { state: ESwapTxHistoryStatus.PENDING },
    });
    await service.onSwapBroadcast(third);
    await service.onSwapStatus({
      history: third,
      status: { state: ESwapTxHistoryStatus.SUCCESS },
    });
    await service.stopForPrivacyTransition();
    expect(liveActivity.start).toHaveBeenCalledTimes(1);
    expect(liveActivity.update).not.toHaveBeenCalled();
    expect(liveActivity.end).toHaveBeenCalledTimes(1);
  });

  it('closes an exact deposit match after the background service restarts without history', async () => {
    const oldService = new ServiceLiveActivity({ backgroundApi: {} });
    await oldService.onSwapBroadcast(createHistory());
    const activity = status.activities[0];
    if (!activity) throw new OneKeyLocalError('Expected activity');
    status.activities.push({
      ...activity,
      activityId: 'unrelated-activity',
      order: {
        ...activity.order,
        orderKey: 'swap:other',
        depositTxId: 'other-deposit',
      },
    });
    const ended = deferred<void>();
    const end = jest
      .spyOn(liveActivity, 'end')
      .mockImplementation(async (orderKey) => {
        status.activities = status.activities.filter(
          (item) => item.order.orderKey !== orderKey,
        );
        ended.resolve();
        return status;
      });
    const restartedService = new ServiceLiveActivity({ backgroundApi: {} });
    await restartedService.onSwapDepositReplaced({ oldTxId: 'deposit-a' });
    await ended.promise;
    expect(end).toHaveBeenCalledWith('swap:synthetic-order');
    expect(status.activities.map((item) => item.order.orderKey)).toEqual([
      'swap:other',
    ]);
  });

  it('does not schedule replacement cleanup after a privacy transition begins', async () => {
    const oldService = new ServiceLiveActivity({ backgroundApi: {} });
    await oldService.onSwapBroadcast(createHistory());
    const previousStatus = { ...status, activities: [...status.activities] };
    const pendingRead = deferred<ILiveActivitySystemStatus>();
    jest
      .mocked(liveActivity.getStatus)
      .mockImplementationOnce(() => pendingRead.promise);
    const end = jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const restartedService = new ServiceLiveActivity({ backgroundApi: {} });
    const replacing = restartedService.onSwapDepositReplaced({
      oldTxId: 'deposit-a',
    });
    await restartedService.stopForPrivacyTransition();
    pendingRead.resolve(previousStatus);
    await replacing;
    expect(end).toHaveBeenCalledTimes(1);
    expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
  });

  it('propagates failure to clear native tracking during privacy cleanup', async () => {
    jest
      .mocked(liveActivity.clearTracking)
      .mockRejectedValue(new OneKeyLocalError('Native module too old'));
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    await expect(service.stopForPrivacyTransition()).rejects.toThrow(
      'Native module too old',
    );
  });

  it('drains pending creation and prevents new activity during a privacy transition', async () => {
    const creation = deferred<ILiveActivitySystemStatus>();
    const started = deferred<void>();
    const originalStart = jest
      .mocked(liveActivity.start)
      .getMockImplementation();
    jest.mocked(liveActivity.start).mockImplementation(async (snapshot) => {
      if (!originalStart) throw new OneKeyLocalError('Missing mock');
      await originalStart(snapshot);
      started.resolve();
      return creation.promise;
    });
    jest.spyOn(liveActivity, 'end').mockImplementation(async () => {
      status.activities = [];
      return status;
    });
    const service = new ServiceLiveActivity({ backgroundApi: {} });
    const broadcast = service.onSwapBroadcast(createHistory());
    await started.promise;
    const stopping = service.stopForPrivacyTransition();
    await service.onSwapBroadcast(createHistory());
    expect(liveActivity.start).toHaveBeenCalledTimes(1);
    expect(liveActivity.end).not.toHaveBeenCalled();
    creation.resolve(status);
    await Promise.all([broadcast, stopping]);
    expect(liveActivity.end).toHaveBeenCalledTimes(1);
    expect(liveActivity.clearTracking).toHaveBeenCalledTimes(1);
    expect(status.activities).toEqual([]);
  });

  it('does not reject the broadcast owner when native creation fails', async () => {
    jest
      .mocked(liveActivity.start)
      .mockRejectedValue(new OneKeyLocalError('Synthetic native failure'));
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
        first.reject(new OneKeyLocalError('Synthetic subscription failure'));
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
