import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  filterSwapHistoryPendingList,
  inAppNotificationAtom,
} from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

import ServiceSwap from './ServiceSwap';

type IHistoryIdentity = Pick<
  ISwapTxHistory['txInfo'],
  'orderId' | 'txId' | 'useOrderId'
>;

function createPendingHistory(identity: IHistoryIdentity): ISwapTxHistory {
  const token = {
    networkId: 'evm--1',
    contractAddress: '0xtoken',
    decimals: 18,
    symbol: 'TOKEN',
  };
  const network = {
    networkId: token.networkId,
    name: 'Ethereum',
    symbol: 'ETH',
  };
  const created = Date.now();

  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: {
        accountId: 'sender-account',
        networkId: token.networkId,
      },
      receiver: {
        accountId: 'receiver-account',
        networkId: token.networkId,
      },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
      fromNetwork: network,
      toNetwork: network,
    },
    txInfo: {
      ...identity,
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      provider: {
        provider: 'onekey',
        providerName: 'OneKey',
      },
      instantRate: '1',
    },
    date: {
      created,
      updated: created,
    },
  };
}

function findPendingHistory(identity: IHistoryIdentity) {
  return inAppNotificationAtom
    .get()
    .then(({ swapHistoryPendingList }) =>
      filterSwapHistoryPendingList(swapHistoryPendingList).find((item) =>
        identity.useOrderId
          ? item.txInfo.orderId === identity.orderId
          : item.txInfo.txId === identity.txId,
      ),
    );
}

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('swap pending history handoff', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let initialNotificationState: Awaited<
    ReturnType<typeof inAppNotificationAtom.get>
  >;
  let loggerErrorSpy: jest.SpyInstance;
  let waitSpy: jest.SpyInstance;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialNotificationState = await inAppNotificationAtom.get();
  });

  beforeEach(async () => {
    loggerErrorSpy = jest
      .spyOn(defaultLogger.app.error, 'log')
      .mockImplementation();
    // Persistence retries back off by seconds. Collapse the waits so the suite
    // does not pay for them; the backoff itself is asserted on the spy below.
    waitSpy = jest
      .spyOn(timerUtils, 'wait')
      .mockImplementation(() => Promise.resolve(undefined));
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await inAppNotificationAtom.set(initialNotificationState);
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each([
    {
      path: 'normal broadcast',
      identity: {
        txId: '0xnormal',
      },
    },
    {
      path: 'signed-no-send order',
      identity: {
        orderId: 'signed-order',
        useOrderId: true,
      },
    },
  ])(
    'publishes pending history before one close when $path persistence fails',
    async ({ identity }) => {
      const history = createPendingHistory(identity);
      const persistenceError = new Error('durable history unavailable');
      const events: string[] = [];
      const stagePendingSwapHistoryItem = jest.fn(async () => {
        events.push('stage');
      });
      const commitPendingSwapHistoryItem = jest.fn(async () => {
        expect(await findPendingHistory(identity)).toBeDefined();
        events.push('commit');
        throw persistenceError;
      });
      const service = new ServiceSwap({
        backgroundApi: {
          serviceNetwork: {
            getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
          },
          simpleDb: {
            swapHistory: {
              stagePendingSwapHistoryItem,
              commitPendingSwapHistoryItem,
            },
          },
        },
      });
      const onSwapBroadcast = jest.fn(async () => {
        expect(await findPendingHistory(identity)).toBeDefined();
        events.push('close');
      });
      const completeBroadcast = async () => {
        await service.addSwapHistoryItem(history);
        expect(await findPendingHistory(identity)).toBeDefined();
        await onSwapBroadcast();
      };

      await expect(completeBroadcast()).resolves.toBeUndefined();

      expect(stagePendingSwapHistoryItem).toHaveBeenCalledTimes(1);
      expect(commitPendingSwapHistoryItem).toHaveBeenCalledTimes(3);
      expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['stage', 'commit', 'commit', 'commit', 'close']);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Persist swap history error: durable history unavailable',
      );
    },
  );

  it('spaces persistence retries instead of firing them in one tick', async () => {
    // The failures this guards against — quota exceeded, storage unavailable —
    // outlive a tick, so back-to-back attempts would all fail identically and
    // the retry budget would buy nothing.
    const history = createPendingHistory({ txId: '0xbackoff' });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
            commitPendingSwapHistoryItem: jest.fn(),
            addSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
          },
        },
      },
    });

    await service.addSwapHistoryItem(history);

    const delays = waitSpy.mock.calls.map(([ms]) => ms as number);
    expect(delays).toEqual([1000, 2000, 1000, 2000]);
  });

  it('reports a handoff that reached no storage at all as not durable', async () => {
    // Resolving without this flag reads as an acknowledgement, but the only
    // record left is the notification atom, which is persist: false.
    const history = createPendingHistory({ txId: '0xnon-durable' });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
            commitPendingSwapHistoryItem: jest.fn(),
            addSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
          },
        },
      },
    });

    await expect(service.addSwapHistoryItem(history)).resolves.toEqual({
      durable: false,
    });
  });

  it('reports a staged-but-uncommitted handoff as durable', async () => {
    // recoverPendingSwapHistoryItems promotes the staged row on the next
    // history read, so the write survives a restart even without the commit.
    const history = createPendingHistory({ txId: '0xstaged-only' });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem: jest.fn().mockResolvedValue(undefined),
            commitPendingSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('storage unavailable')),
          },
        },
      },
    });

    await expect(service.addSwapHistoryItem(history)).resolves.toEqual({
      durable: true,
    });
  });

  it('retries a transient staging failure before publishing', async () => {
    const history = createPendingHistory({ txId: '0xstage-retry' });
    const stagePendingSwapHistoryItem = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary storage failure'))
      .mockResolvedValue(undefined);
    const commitPendingSwapHistoryItem = jest.fn().mockResolvedValue(undefined);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem,
            commitPendingSwapHistoryItem,
          },
        },
      },
    });

    await service.addSwapHistoryItem(history);

    expect(stagePendingSwapHistoryItem).toHaveBeenCalledTimes(2);
    expect(commitPendingSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(await findPendingHistory({ txId: '0xstage-retry' })).toBeDefined();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('recovers a staged pending write after the background service restarts', async () => {
    const history = createPendingHistory({ txId: '0xrestart' });
    let stagedHistories: ISwapTxHistory[] = [];
    let persistedHistories: ISwapTxHistory[] = [];
    const swapHistoryDb = {
      stagePendingSwapHistoryItem: jest.fn(async (item: ISwapTxHistory) => {
        stagedHistories = [item];
      }),
      commitPendingSwapHistoryItem: jest
        .fn()
        .mockRejectedValue(new Error('commit interrupted')),
      recoverPendingSwapHistoryItems: jest.fn(async () => {
        persistedHistories = [...stagedHistories, ...persistedHistories];
        stagedHistories = [];
      }),
      getSwapHistoryList: jest.fn(async () => persistedHistories),
      repairSwapHistoryNetworkInfo: jest.fn(async () => ({
        histories: persistedHistories,
        changed: false,
      })),
    };
    const createService = () =>
      new ServiceSwap({
        backgroundApi: {
          serviceNetwork: {
            getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
          },
          simpleDb: { swapHistory: swapHistoryDb },
        },
      });

    await createService().addSwapHistoryItem(history);
    expect(stagedHistories).toEqual([history]);

    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
    await createService().syncSwapHistoryPendingList();

    expect(await findPendingHistory({ txId: '0xrestart' })).toBeDefined();
    expect(persistedHistories).toEqual([history]);
    expect(stagedHistories).toEqual([]);
  });

  it('keeps terminal history publication behind durable persistence', async () => {
    const history = {
      ...createPendingHistory({ txId: '0xterminal' }),
      status: ESwapTxHistoryStatus.SUCCESS,
    };
    const persistenceError = new Error('durable history unavailable');
    const addSwapHistoryItem = jest.fn().mockRejectedValue(persistenceError);
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            addSwapHistoryItem,
          },
        },
      },
    });
    const atomSetSpy = jest.spyOn(inAppNotificationAtom, 'set');

    await expect(service.addSwapHistoryItem(history)).rejects.toBe(
      persistenceError,
    );

    expect(addSwapHistoryItem).toHaveBeenCalledTimes(1);
    expect(atomSetSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });
});

describe('durable pending swap history promotion', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let initialNotificationState: Awaited<
    ReturnType<typeof inAppNotificationAtom.get>
  >;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialNotificationState = await inAppNotificationAtom.get();
  });

  beforeEach(async () => {
    jest.spyOn(defaultLogger.app.error, 'log').mockImplementation();
    // Same reason as the handoff suite: skip the real retry backoff.
    jest
      .spyOn(timerUtils, 'wait')
      .mockImplementation(() => Promise.resolve(undefined));
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await inAppNotificationAtom.set(initialNotificationState);
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  function createService(updateSwapHistoryItem: jest.Mock) {
    const deleteOneSwapHistory = jest.fn();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            stagePendingSwapHistoryItem: jest.fn(),
            commitPendingSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(new Error('commit interrupted')),
            updateSwapHistoryItem,
            deleteOneSwapHistory,
          },
        },
      },
    });
    return { deleteOneSwapHistory, service };
  }

  it('delegates a staged-row promotion to the durable entity', async () => {
    const updateSwapHistoryItem = jest.fn();
    const { service } = createService(updateSwapHistoryItem);
    const history = createPendingHistory({ txId: '0xlostwrite' });

    await service.addSwapHistoryItem(history);
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [],
    }));
    await service.updateSwapHistoryItem(
      { ...history, status: ESwapTxHistoryStatus.SUCCESS },
      { shouldShowToast: false },
    );

    expect(updateSwapHistoryItem).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it('never grants an update an in-memory insertion permission', async () => {
    const updateSwapHistoryItem = jest.fn();
    const { service } = createService(updateSwapHistoryItem);
    const history = createPendingHistory({ txId: '0xneverstaged' });

    await service.updateSwapHistoryItem(
      { ...history, status: ESwapTxHistoryStatus.SUCCESS },
      { shouldShowToast: false },
    );

    expect(updateSwapHistoryItem).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it('deletes the durable stage when the user clears that history', async () => {
    const updateSwapHistoryItem = jest.fn();
    const { deleteOneSwapHistory, service } = createService(
      updateSwapHistoryItem,
    );
    const history = createPendingHistory({ txId: '0xcleared' });

    await service.addSwapHistoryItem(history);
    await service.cleanOneSwapHistory({ txId: '0xcleared' });
    await service.updateSwapHistoryItem(
      { ...history, status: ESwapTxHistoryStatus.SUCCESS },
      { shouldShowToast: false },
    );

    expect(deleteOneSwapHistory).toHaveBeenCalledWith({ txId: '0xcleared' });
    expect(updateSwapHistoryItem).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
    );
  });

  it('keeps the atom pending when durable status promotion fails', async () => {
    const history = createPendingHistory({ txId: '0xpromotion-fails' });
    const persistenceError = new Error('promotion failed');
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            updateSwapHistoryItem: jest
              .fn()
              .mockRejectedValue(persistenceError),
          },
        },
      },
    });
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));

    await expect(
      service.updateSwapHistoryItem(
        { ...history, status: ESwapTxHistoryStatus.SUCCESS },
        { shouldShowToast: false },
      ),
    ).rejects.toBe(persistenceError);

    expect(
      (await findPendingHistory({ txId: '0xpromotion-fails' }))?.status,
    ).toBe(ESwapTxHistoryStatus.PENDING);
  });

  it('keeps storage and the pending atom deleted when clear wins the race', async () => {
    const history = createPendingHistory({ txId: '0xclear-race' });
    let persistedHistory: ISwapTxHistory | undefined = history;
    const deleteStarted = createDeferred();
    const releaseDelete = createDeferred();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: {
          getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
        },
        simpleDb: {
          swapHistory: {
            deleteSwapHistoryItem: jest.fn(
              async (statuses?: ESwapTxHistoryStatus[]) => {
                const shouldDelete =
                  !!persistedHistory &&
                  (!statuses || statuses.includes(persistedHistory.status));
                deleteStarted.resolve();
                await releaseDelete.promise;
                if (shouldDelete) {
                  persistedHistory = undefined;
                }
              },
            ),
            updateSwapHistoryItem: jest.fn(async (item: ISwapTxHistory) => {
              if (persistedHistory) {
                persistedHistory = item;
              }
            }),
          },
        },
      },
    });
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapHistoryPendingList: [history],
    }));

    const clearPromise = service.cleanSwapHistoryItems([
      ESwapTxHistoryStatus.PENDING,
    ]);
    await deleteStarted.promise;
    const updatePromise = service.updateSwapHistoryItem(
      { ...history, status: ESwapTxHistoryStatus.SUCCESS },
      { shouldShowToast: false },
    );
    await Promise.resolve();
    releaseDelete.resolve();
    await Promise.all([clearPromise, updatePromise]);

    expect(persistedHistory).toBeUndefined();
    expect(await findPendingHistory({ txId: '0xclear-race' })).toBeUndefined();
  });
});
