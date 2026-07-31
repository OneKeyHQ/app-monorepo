import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

describe('swap pending history handoff', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let initialNotificationState: Awaited<
    ReturnType<typeof inAppNotificationAtom.get>
  >;
  let loggerErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialNotificationState = await inAppNotificationAtom.get();
  });

  beforeEach(async () => {
    loggerErrorSpy = jest
      .spyOn(defaultLogger.app.error, 'log')
      .mockImplementation();
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
      const addSwapHistoryItem = jest.fn(async () => {
        expect(await findPendingHistory(identity)).toBeDefined();
        events.push('pending');
        events.push('persist');
        throw persistenceError;
      });
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

      expect(addSwapHistoryItem).toHaveBeenCalledTimes(1);
      expect(onSwapBroadcast).toHaveBeenCalledTimes(1);
      expect(events).toEqual(['pending', 'persist', 'close']);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Persist swap history error: durable history unavailable',
      );
    },
  );

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
