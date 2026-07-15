import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

function createHistory(created: number): ISwapTxHistory {
  const token = {
    networkId: 'evm--4663',
    contractAddress: '0xtoken',
    decimals: 18,
    symbol: 'TOKEN',
  };
  const network = {
    networkId: token.networkId,
    name: '',
    symbol: '',
  };
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: { networkId: token.networkId },
      receiver: { networkId: token.networkId },
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
      txId: `0x${created}`,
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      provider: { provider: 'onekey', providerName: 'OneKey' },
      instantRate: '1',
    },
    date: { created, updated: created },
  };
}

describe('ServiceSwap history network repair', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('returns the current SimpleDB snapshot after asynchronous network lookup', async () => {
    const staleHistory = createHistory(1);
    const currentHistory = createHistory(2);
    const getSwapHistoryList = jest.fn().mockResolvedValue([staleHistory]);
    const repairSwapHistoryNetworkInfo = jest.fn().mockResolvedValue({
      histories: [staleHistory, currentHistory],
      changed: false,
    });
    const getNetworksByIds = jest.fn().mockResolvedValue({ networks: [] });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceNetwork: { getNetworksByIds },
        simpleDb: {
          swapHistory: {
            getSwapHistoryList,
            repairSwapHistoryNetworkInfo,
          },
        },
      },
    });

    const histories = await service.fetchSwapHistoryListFromSimple();

    expect(getNetworksByIds).toHaveBeenCalledWith({
      networkIds: ['evm--4663'],
    });
    expect(repairSwapHistoryNetworkInfo).toHaveBeenCalledWith([]);
    expect(histories).toEqual([currentHistory, staleHistory]);
  });
});
