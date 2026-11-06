import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { buildSwapLiveActivitySnapshot } from '@onekeyhq/shared/src/utils/liveActivityUtils';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntitySwapHistory } from '../dbs/simple/entity/SimpleDbEntitySwapHistory';
import { inAppNotificationAtom } from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

import { clearReplacementGuards } from './ServiceLiveActivity/replacementGuard';
import { liveActivityRemoteTracking } from './ServiceLiveActivity/subscriptionTransport';
import ServiceSwap from './ServiceSwap';

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
    status: ESwapTxHistoryStatus.FAILED,
    crossChainStatus: ESwapCrossChainStatus.REFUNDING,
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
      txId: 'mock-deposit',
      sender: 'mock-sender',
      receiver: 'mock-receiver',
    },
    swapInfo: {
      provider: { provider: 'mock', providerName: 'Mock' },
      instantRate: '1',
      orderId: 'mock-service-order',
    },
    date: { created: Date.now(), updated: Date.now() },
  };
}

describe('Swap Live Activity refund polling', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
  });
  beforeEach(async () => {
    clearReplacementGuards();
    jest.spyOn(liveActivityRemoteTracking, 'isReady').mockReturnValue(true);
    jest.useFakeTimers();
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('shares one in-flight status request between simultaneous refreshes', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    let resolveStatus: (
      value: IFetchSwapTxHistoryStatusResponse,
    ) => void = () => {};
    let markStarted: () => void = () => {};
    const response = new Promise<IFetchSwapTxHistoryStatusResponse>(
      (resolve) => {
        resolveStatus = resolve;
      },
    );
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const onSwapStatus = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceSwap({
      backgroundApi: { serviceLiveActivity: { onSwapStatus } },
    });
    const fetchState = jest
      .spyOn(service, 'fetchTxState')
      .mockImplementation(() => {
        markStarted();
        return response;
      });
    jest
      .spyOn(service, 'updateSwapHistoryItem')
      .mockImplementation(async (item) => item);
    const first = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    await started;
    const second = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    expect(fetchState).toHaveBeenCalledTimes(1);
    resolveStatus({
      state: ESwapTxHistoryStatus.PENDING,
      crossChainStatus: ESwapCrossChainStatus.TO_PENDING,
    });
    await Promise.all([first, second]);
    expect(fetchState).toHaveBeenCalledTimes(1);
    expect(onSwapStatus).toHaveBeenCalledTimes(1);

    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    expect(fetchState).toHaveBeenCalledTimes(2);
  });

  it('projects a confirmed cancellation as canceled after history reconciliation', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.CANCELING;
    history.crossChainStatus = undefined;
    const onSwapStatus = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceLiveActivity: { onSwapStatus },
        serviceHistory: { clearLocalHistoryPendingTxByTxId: jest.fn() },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.SUCCESS,
    });
    jest
      .spyOn(service, 'updateSwapHistoryItem')
      .mockImplementation(async (item) => ({
        ...item,
        status: ESwapTxHistoryStatus.CANCELED,
      }));
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(onSwapStatus).toHaveBeenCalledTimes(1);
    const [{ history: projectedHistory, status }] = onSwapStatus.mock.calls[0];
    expect(
      buildSwapLiveActivitySnapshot(projectedHistory, status)?.content.status,
    ).toBe('canceled');
  });

  it.each(['refresh', 'poll'] as const)(
    'keeps the polling timer when %s starts the shared request first',
    async (firstCaller) => {
      const history = createHistory();
      history.status = ESwapTxHistoryStatus.PENDING;
      history.crossChainStatus = undefined;
      await inAppNotificationAtom.set((pre) => ({
        ...pre,
        swapHistoryPendingList: [history],
      }));
      let resolveStatus: (
        value: IFetchSwapTxHistoryStatusResponse,
      ) => void = () => {};
      let markStarted: () => void = () => {};
      const response = new Promise<IFetchSwapTxHistoryStatusResponse>(
        (resolve) => {
          resolveStatus = resolve;
        },
      );
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const service = new ServiceSwap({
        backgroundApi: {
          simpleDb: {
            swapHistory: {
              getSwapHistoryList: jest.fn().mockResolvedValue([]),
            },
          },
          serviceLiveActivity: {
            onSwapStatus: jest.fn().mockResolvedValue(undefined),
          },
        },
      });
      const fetchState = jest
        .spyOn(service, 'fetchTxState')
        .mockImplementation(() => {
          markStarted();
          return response;
        });
      let markJoined: () => void = () => {};
      const joined = new Promise<void>((resolve) => {
        markJoined = resolve;
      });
      const originalRunFetch = service.swapHistoryStatusRunFetch.bind(service);
      const runFetch = jest.spyOn(service, 'swapHistoryStatusRunFetch');
      runFetch.mockImplementation((...args) => {
        const result = originalRunFetch(...args);
        if (runFetch.mock.calls.length === 2) markJoined();
        return result;
      });
      const refresh = () =>
        service.swapHistoryStatusRunFetch(history, {
          shouldScheduleNextFetch: false,
          shouldShowToast: false,
        });
      const poll = () => service.swapHistoryStatusFetchLoop();
      const first = firstCaller === 'refresh' ? refresh() : poll();
      await started;
      const second = firstCaller === 'refresh' ? poll() : refresh();
      await joined;
      resolveStatus({ state: ESwapTxHistoryStatus.PENDING });
      await Promise.all([first, second]);
      expect(fetchState).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(1);
    },
  );

  it('ignores an old deposit failure that arrives after a replacement broadcast', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    let resolveStatus: (
      value: IFetchSwapTxHistoryStatusResponse,
    ) => void = () => {};
    let markStarted: () => void = () => {};
    const response = new Promise<IFetchSwapTxHistoryStatusResponse>(
      (resolve) => {
        resolveStatus = resolve;
      },
    );
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const onSwapStatus = jest.fn().mockResolvedValue(undefined);
    const updateSwapHistoryItem = jest.fn(async (item: ISwapTxHistory) => item);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceLiveActivity: { onSwapStatus },
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: { swapHistory: { updateSwapHistoryItem } },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockImplementation(async () => {
      markStarted();
      return response;
    });
    const polling = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    await started;
    await service.updateSwapHistoryTx({
      oldTxId: history.txInfo.txId ?? '',
      newTxId: 'replacement-deposit',
      status: ESwapTxHistoryStatus.PENDING,
    });
    resolveStatus({ state: ESwapTxHistoryStatus.FAILED });
    await polling;
    expect(onSwapStatus).not.toHaveBeenCalled();
    expect(updateSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(updateSwapHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        txInfo: expect.objectContaining({ txId: 'replacement-deposit' }),
        swapInfo: expect.objectContaining({
          liveActivityOrderKey: 'swap:mock-service-order',
        }),
      }),
      history.txInfo.txId,
    );
  });

  it.each([undefined, 'other-deposit'])(
    'does not publish an old failure during replacement (response txId: %s)',
    async (responseTxId) => {
      const history = createHistory();
      history.status = ESwapTxHistoryStatus.PENDING;
      history.crossChainStatus = undefined;
      await inAppNotificationAtom.set((pre) => ({
        ...pre,
        swapHistoryPendingList: [history],
      }));
      let releaseNetworks: (value: { networks: [] }) => void = () => {};
      let markStarted: () => void = () => {};
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const pendingNetworks = new Promise<{ networks: [] }>((resolve) => {
        releaseNetworks = resolve;
      });
      const getNetworksByIds = jest
        .fn()
        .mockImplementationOnce(() => {
          markStarted();
          return pendingNetworks;
        })
        .mockResolvedValue({ networks: [] });
      const updateSwapHistoryItem = jest.fn(
        async (item: ISwapTxHistory) => item,
      );
      const onSwapStatus = jest.fn().mockResolvedValue(undefined);
      const showToast = jest.fn().mockResolvedValue(undefined);
      const service = new ServiceSwap({
        backgroundApi: {
          serviceLiveActivity: { onSwapStatus },
          serviceNetwork: { getNetworksByIds },
          serviceApp: { showToast },
          simpleDb: { swapHistory: { updateSwapHistoryItem } },
        },
      });
      jest.spyOn(service, 'fetchTxState').mockResolvedValue({
        state: ESwapTxHistoryStatus.FAILED,
        txId: responseTxId,
      });
      const polling = service.swapHistoryStatusRunFetch(history, {
        shouldScheduleNextFetch: false,
      });
      await started;
      await service.updateSwapHistoryTx({
        oldTxId: history.txInfo.txId ?? '',
        newTxId: 'replacement-deposit',
        status: ESwapTxHistoryStatus.PENDING,
      });
      releaseNetworks({ networks: [] });
      await polling;
      expect(updateSwapHistoryItem).toHaveBeenCalledTimes(1);
      expect(updateSwapHistoryItem).toHaveBeenCalledWith(
        expect.objectContaining({
          txInfo: expect.objectContaining({ txId: 'replacement-deposit' }),
        }),
        history.txInfo.txId,
      );
      expect(onSwapStatus).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    },
  );

  it('does not replace the pending atom with an old response when RBF starts during persistence', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    history.txInfo.useOrderId = true;
    history.txInfo.orderId = 'synthetic-provider-order';
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    let finishWrite: () => void = () => {};
    let markStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const firstWrite = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    let durableHistory = history;
    const updateSwapHistoryItem = jest.fn(
      async (item: ISwapTxHistory, oldTxId?: string) => {
        let matches = durableHistory.txInfo.txId === item.txInfo.txId;
        if (oldTxId) {
          matches = durableHistory.txInfo.txId === oldTxId;
        } else if (item.txInfo.useOrderId) {
          matches = durableHistory.txInfo.orderId === item.txInfo.orderId;
        }
        if (!matches) return undefined;
        durableHistory = item;
        return item;
      },
    );
    const updateSwapHistoryItemIfCurrent = jest.fn(
      async (item: ISwapTxHistory, shouldCommit: () => boolean) => {
        markStarted();
        await firstWrite;
        if (!shouldCommit()) return undefined;
        durableHistory = item;
        return item;
      },
    );
    const onSwapStatus = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceLiveActivity: { onSwapStatus },
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceApp: { showToast: jest.fn() },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItem,
            updateSwapHistoryItemIfCurrent,
          },
        },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.FAILED,
      txId: 'other-deposit',
    });
    const polling = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    await started;
    const replacement = service.updateSwapHistoryTx({
      oldTxId: history.txInfo.txId ?? '',
      newTxId: 'replacement-deposit',
      status: ESwapTxHistoryStatus.PENDING,
    });
    finishWrite();
    await Promise.all([polling, replacement]);
    const pending = await inAppNotificationAtom.get();
    expect(pending.swapHistoryPendingList[0]?.txInfo.txId).toBe(
      'replacement-deposit',
    );
    expect(updateSwapHistoryItemIfCurrent).toHaveBeenCalledTimes(1);
    expect(updateSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(durableHistory.txInfo.txId).toBe('replacement-deposit');
    expect(onSwapStatus).not.toHaveBeenCalled();
  });

  it('applies consecutive replacements after the previous replacement commits', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    let durableHistory = history;
    let markStarted: () => void = () => {};
    let release: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const persist = jest.fn(async (item: ISwapTxHistory, oldTxId?: string) => {
      if (oldTxId === 'mock-deposit') {
        markStarted();
        await paused;
      }
      if (durableHistory.txInfo.txId !== oldTxId) return undefined;
      durableHistory = item;
      return item;
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: { swapHistory: { updateSwapHistoryItem: persist } },
      },
    });
    const first = service.updateSwapHistoryTx({
      oldTxId: 'mock-deposit',
      newTxId: 'deposit-b',
      status: ESwapTxHistoryStatus.PENDING,
    });
    await started;
    const second = service.updateSwapHistoryTx({
      oldTxId: 'deposit-b',
      newTxId: 'deposit-c',
      status: ESwapTxHistoryStatus.PENDING,
    });
    release();
    await Promise.all([first, second]);
    expect(durableHistory.txInfo.txId).toBe('deposit-c');
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo
        .txId,
    ).toBe('deposit-c');
  });

  it('does not publish a replacement when its stored history was deleted', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItem: jest.fn().mockResolvedValue(undefined),
          },
        },
      },
    });
    await expect(
      service.updateSwapHistoryTx({
        oldTxId: 'mock-deposit',
        newTxId: 'deposit-b',
        status: ESwapTxHistoryStatus.PENDING,
      }),
    ).resolves.toBeUndefined();
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo
        .txId,
    ).toBe('mock-deposit');
  });

  it('preserves real replacement storage failures for the caller', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new OneKeyLocalError('storage unavailable')),
          },
        },
      },
    });
    await expect(
      service.updateSwapHistoryTx({
        oldTxId: 'mock-deposit',
        newTxId: 'deposit-b',
        status: ESwapTxHistoryStatus.PENDING,
      }),
    ).rejects.toThrow('storage unavailable');
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo
        .txId,
    ).toBe('mock-deposit');
  });

  it('uses the original deposit to persist an authoritative status with a different txId', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const guardedUpdate = jest.fn(async (item: ISwapTxHistory) => item);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceHistory: {
          clearLocalHistoryPendingTxByTxId: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: {
          swapHistory: { updateSwapHistoryItemIfCurrent: guardedUpdate },
        },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.FAILED,
      txId: 'server-deposit',
    });
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(guardedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        txInfo: expect.objectContaining({ txId: 'server-deposit' }),
      }),
      expect.any(Function),
      undefined,
      'mock-deposit',
    );
  });

  it('updates the actual pending atom and stored row when a status response changes txId', async () => {
    jest.useRealTimers();
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const entity = new SimpleDbEntitySwapHistory();
    let stored = JSON.stringify({
      data: { histories: [history] },
      updatedAt: 1,
    });
    entity.appStorage = {
      ...entity.appStorage,
      getItem: jest.fn(async () => stored),
      setItem: jest.fn(async (_key, value) => {
        stored = typeof value === 'string' ? value : JSON.stringify(value);
      }),
    };
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: { swapHistory: entity },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.PENDING,
      crossChainStatus: ESwapCrossChainStatus.TO_PENDING,
      txId: 'server-deposit',
    });
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo
        .txId,
    ).toBe('server-deposit');
    expect((await entity.getRawData())?.histories[0]?.txInfo.txId).toBe(
      'server-deposit',
    );
    jest.useFakeTimers();
  });

  it('continues polling under the updated txId and stops when that row is deleted', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const entity = {
      getSwapHistoryList: jest.fn().mockResolvedValue([]),
      updateSwapHistoryItemIfCurrent: jest.fn(
        async (item: ISwapTxHistory) => item,
      ),
      deleteOneSwapHistory: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: { swapHistory: entity },
      },
    });
    const fetch = jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.PENDING,
      crossChainStatus: ESwapCrossChainStatus.TO_PENDING,
      txId: 'server-deposit',
    });
    await service.swapHistoryStatusFetchLoop();
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo
        .txId,
    ).toBe('server-deposit');
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersToNextTimerAsync();
    expect(fetch).toHaveBeenCalledTimes(2);
    await service.cleanOneSwapHistory({ txId: 'server-deposit' });
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await inAppNotificationAtom.get()).swapHistoryPendingList).toEqual(
      [],
    );
  });

  it('cleans both transaction timer keys after a terminal A to B update', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceHistory: {
          clearLocalHistoryPendingTxByTxId: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItemIfCurrent: jest.fn(
              async (item: ISwapTxHistory) => item,
            ),
          },
        },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.FAILED,
      txId: 'server-deposit',
    });
    const cleanup = jest.spyOn(service, 'cleanHistoryStateIntervals');
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(cleanup).toHaveBeenCalledWith('mock-deposit');
    expect(cleanup).toHaveBeenCalledWith('server-deposit');
  });

  it('preserves cancellation semantics when the response changes the txId', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.CANCELING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceHistory: {
          clearLocalHistoryPendingTxByTxId: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItemIfCurrent: jest.fn(
              async (item: ISwapTxHistory) => item,
            ),
          },
        },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.SUCCESS,
      txId: 'server-deposit',
    });
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(
      (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.status,
    ).toBe(ESwapTxHistoryStatus.CANCELED);
  });

  it('does not restore a deleted row when an old guarded status returns', async () => {
    jest.useRealTimers();
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const entity = new SimpleDbEntitySwapHistory();
    let stored = JSON.stringify({
      data: { histories: [history] },
      updatedAt: 1,
    });
    entity.appStorage = {
      ...entity.appStorage,
      getItem: jest.fn(async () => stored),
      setItem: jest.fn(async (_key, value) => {
        stored = typeof value === 'string' ? value : JSON.stringify(value);
      }),
    };
    let releaseNetworks: (value: { networks: [] }) => void = () => {};
    let signalStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const waiting = new Promise<{ networks: [] }>((resolve) => {
      releaseNetworks = resolve;
    });
    const showToast = jest.fn();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn(() => {
            signalStarted();
            return waiting;
          }),
        },
        serviceApp: { showToast },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: { swapHistory: entity },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.FAILED,
      txId: 'server-deposit',
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const polling = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
    });
    await started;
    await service.cleanOneSwapHistory({ txId: 'mock-deposit' });
    releaseNetworks({ networks: [] });
    await polling;
    expect((await inAppNotificationAtom.get()).swapHistoryPendingList).toEqual(
      [],
    );
    expect((await entity.getRawData())?.histories).toEqual([]);
    expect(showToast).not.toHaveBeenCalled();
    error.mockRestore();
    jest.useFakeTimers();
  });

  it('deletes the same order when deletion is queued behind an A to B persistence', async () => {
    jest.useRealTimers();
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const entity = new SimpleDbEntitySwapHistory();
    let stored = JSON.stringify({
      data: { histories: [history] },
      updatedAt: 1,
    });
    let markStarted: () => void = () => {};
    let releaseWrite: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let writes = 0;
    entity.appStorage = {
      ...entity.appStorage,
      getItem: jest.fn(async () => stored),
      setItem: jest.fn(async (_key, value) => {
        stored = typeof value === 'string' ? value : JSON.stringify(value);
        writes += 1;
        if (writes === 1) {
          markStarted();
          await waiting;
        }
      }),
    };
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
        simpleDb: { swapHistory: entity },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.PENDING,
      crossChainStatus: ESwapCrossChainStatus.TO_PENDING,
      txId: 'server-deposit',
    });
    const polling = service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    await started;
    const deletion = service.cleanOneSwapHistory({ txId: 'mock-deposit' });
    releaseWrite();
    await Promise.all([polling, deletion]);
    expect((await inAppNotificationAtom.get()).swapHistoryPendingList).toEqual(
      [],
    );
    expect((await entity.getRawData())?.histories).toEqual([]);
    jest.useFakeTimers();
  });

  it('does not load or poll refunds solely for disabled Live Activities', async () => {
    jest.mocked(liveActivityRemoteTracking.isReady).mockReturnValue(false);
    const getSwapHistoryList = jest.fn().mockResolvedValue([createHistory()]);
    const service = new ServiceSwap({
      backgroundApi: { simpleDb: { swapHistory: { getSwapHistoryList } } },
    });
    const fetch = jest
      .spyOn(service, 'swapHistoryStatusRunFetch')
      .mockResolvedValue(undefined);
    await service.swapHistoryStatusFetchLoop();
    expect(getSwapHistoryList).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses the ordinary status persistence path when Live Activities are disabled', async () => {
    jest.mocked(liveActivityRemoteTracking.isReady).mockReturnValue(false);
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const updateSwapHistoryItem = jest.fn(async (item: ISwapTxHistory) => item);
    const updateSwapHistoryItemIfCurrent = jest.fn();
    const onSwapStatus = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        serviceLiveActivity: {
          onSwapStatus,
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItem,
            updateSwapHistoryItemIfCurrent,
          },
        },
      },
    });
    jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.PENDING,
      crossChainStatus: ESwapCrossChainStatus.TO_PENDING,
    });
    await service.swapHistoryStatusRunFetch(history, {
      shouldScheduleNextFetch: false,
      shouldShowToast: false,
    });
    expect(updateSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(updateSwapHistoryItemIfCurrent).not.toHaveBeenCalled();
    expect(onSwapStatus).not.toHaveBeenCalled();
  });

  it('recovers a coarse FAILED refund after restart and stops at eight hours even without a state change', async () => {
    const history = createHistory();
    const service = new ServiceSwap({
      backgroundApi: {
        simpleDb: {
          swapHistory: {
            getSwapHistoryList: jest.fn().mockResolvedValue([history]),
          },
        },
        serviceLiveActivity: {
          onSwapStatus: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
    const fetchState = jest.spyOn(service, 'fetchTxState').mockResolvedValue({
      state: ESwapTxHistoryStatus.FAILED,
      crossChainStatus: ESwapCrossChainStatus.REFUNDING,
    });
    const cleanup = jest.spyOn(service, 'cleanHistoryStateIntervals');
    await service.swapHistoryStatusFetchLoop();
    expect(fetchState).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    jest.setSystemTime(history.date.created + 8 * 60 * 60 * 1000);
    await service.swapHistoryStatusRunFetch(history);
    expect(cleanup).toHaveBeenCalledWith(history.txInfo.txId);
  });

  it('continues existing pending polling when the optional refund history read fails', async () => {
    const history = createHistory();
    history.status = ESwapTxHistoryStatus.PENDING;
    history.crossChainStatus = undefined;
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        simpleDb: {
          swapHistory: {
            getSwapHistoryList: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
          },
        },
      },
    });
    const fetch = jest
      .spyOn(service, 'swapHistoryStatusRunFetch')
      .mockResolvedValue(undefined);
    await service.swapHistoryStatusFetchLoop();
    expect(fetch).toHaveBeenCalledWith(history);
  });
});
