import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { inAppNotificationAtom } from '../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';

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
    const updateSwapHistoryItem = jest.fn().mockResolvedValue(undefined);
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
