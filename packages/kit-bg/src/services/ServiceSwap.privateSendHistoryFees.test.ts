import { swapHistoryStateFetchInterval } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntitySwapHistory } from '../dbs/simple/entity/SimpleDbEntitySwapHistory';
import { inAppNotificationAtom } from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

import ServiceSwap from './ServiceSwap';

import type { ISwapTxHistoryPersistList } from '../dbs/simple/entity/SimpleDbEntitySwapHistory';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHistory(provider: string): ISwapTxHistory {
  const token = {
    networkId: 'evm--1',
    contractAddress: '',
    decimals: 18,
    symbol: 'ETH',
  };
  return {
    protocol: EProtocolOfExchange.PRIVATE_SEND,
    status: ESwapTxHistoryStatus.PENDING,
    currency: '$',
    currencyId: 'usd',
    accountInfo: {
      sender: { networkId: token.networkId },
      receiver: { networkId: token.networkId },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: 'deposit-tx',
      orderId: 'private-order',
      useOrderId: true,
      sender: 'sender',
      receiver: 'receiver',
    },
    swapInfo: {
      provider: { provider, providerName: provider },
      orderId: 'private-order',
      instantRate: '1',
    },
    date: { created: 1, updated: 1 },
  };
}

describe('Private Send history fees during status polling', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  let initialState: Awaited<ReturnType<typeof inAppNotificationAtom.get>>;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialState = await inAppNotificationAtom.get();
  });
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    await inAppNotificationAtom.set(initialState);
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it.each(
    ['SwapQuickeXPrivateSend', 'SwapRocketXPrivateSend'].flatMap((provider) => [
      { provider, hasEstimate: false },
      { provider, hasEstimate: true },
    ]),
  )(
    'keeps fees filled by detail while a request is in flight and carries them into the next tick for $provider (estimate: $hasEstimate)',
    async ({ provider, hasEstimate }) => {
      const stale = createHistory(provider);
      if (hasEstimate) {
        stale.txInfo.gasFeeInNative = '0.000004583250252';
        stale.txInfo.gasFeeFiatValue = '0.01071256831150716';
      }
      let stored: ISwapTxHistoryPersistList = { histories: [stale] };
      const entity = new SimpleDbEntitySwapHistory();
      jest.spyOn(entity, 'getRawData').mockImplementation(async () => stored);
      jest
        .spyOn(entity, 'setRawData')
        .mockImplementation(async (dataOrBuilder) => {
          stored =
            typeof dataOrBuilder === 'function'
              ? await dataOrBuilder(stored)
              : dataOrBuilder;
          return stored;
        });
      const service = new ServiceSwap({
        backgroundApi: {
          serviceNetwork: {
            getNetworksByIds: jest.fn().mockResolvedValue({ networks: [] }),
          },
          simpleDb: { swapHistory: entity },
        },
      });
      const response = {
        data: {
          data: {
            state: ESwapTxHistoryStatus.PENDING,
            updatedAt: '2026-10-25T14:58:06Z',
          },
        },
      };
      const requestStarted = deferred<void>();
      const responseReady = deferred<typeof response>();
      const get = jest
        .fn()
        .mockResolvedValue(response)
        .mockImplementationOnce(async () => {
          requestStarted.resolve();
          return responseReady.promise;
        });
      jest
        .spyOn(service, 'getClient')
        .mockResolvedValue({ get } as unknown as Awaited<
          ReturnType<ServiceSwap['getClient']>
        >);
      service['historyCurrentStateIntervalIds'] = ['private-order'];
      const poll = jest.spyOn(service, 'swapHistoryStatusRunFetch');
      await inAppNotificationAtom.set((pre) => ({
        ...pre,
        swapHistoryPendingList: [stale],
      }));

      const running = service.swapHistoryStatusRunFetch(stale, {
        shouldShowToast: false,
      });
      await requestStarted.promise;
      const latest = {
        ...stale,
        txInfo: {
          ...stale.txInfo,
          gasFeeInNative: '0.000004020049614',
          gasFeeFiatValue: '0.00939618256429062',
        },
      };
      await service.updateSwapHistoryItem(latest, { shouldShowToast: false });
      responseReady.resolve(response);
      await running;

      expect(stored.histories[0].txInfo).toEqual(latest.txInfo);
      expect(
        (await inAppNotificationAtom.get()).swapHistoryPendingList[0]?.txInfo,
      ).toEqual(latest.txInfo);
      await jest.advanceTimersByTimeAsync(swapHistoryStateFetchInterval);
      expect(poll).toHaveBeenCalledTimes(2);
      expect(poll.mock.calls[1][0].txInfo).toEqual(latest.txInfo);
      expect(stored.histories[0].txInfo).toEqual(latest.txInfo);
    },
  );
});
