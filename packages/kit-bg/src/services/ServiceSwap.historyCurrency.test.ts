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

describe('ServiceSwap history fee currency', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });
  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('polls cross-chain XMR payouts with both order IDs and without the XMR receiver address', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { data: { state: ESwapTxHistoryStatus.SUCCESS } },
    });
    const service = new ServiceSwap({ backgroundApi: {} });
    jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
    const item = createHistory(1);
    item.baseInfo.toToken = {
      networkId: 'xmr--0',
      contractAddress: '',
      symbol: 'XMR',
      decimals: 12,
      isNative: true,
    };
    item.txInfo.receiver = `4${'aB'.repeat(47)}`;
    item.swapInfo.provider.provider = 'SwapRocketX';
    item.swapInfo.orderId = 'onekey-order';
    item.ctx = { rocketXOrderId: 'channel-order', isSingleNetSwap: false };

    await service['fetchSwapHistoryStateTx']({
      currentSwapTxHistory: item,
      isPrivateSendHistory: false,
    });

    expect(post).toHaveBeenCalledWith(
      '/swap/v1/state-tx',
      expect.objectContaining({
        txId: item.txInfo.txId,
        orderId: 'onekey-order',
        ctx: { rocketXOrderId: 'channel-order', isSingleNetSwap: false },
        receivedAddress: undefined,
      }),
      expect.any(Object),
    );
  });

  it.each(['usd', 'eur', undefined])(
    'requests fees in the persisted denomination: %s',
    async (currencyId) => {
      const post = jest.fn().mockResolvedValue({
        data: {
          data: {
            state: ESwapTxHistoryStatus.SUCCESS,
            gasFeeFiatValue: '0.12',
          },
        },
      });
      const service = new ServiceSwap({ backgroundApi: {} });
      jest.spyOn(service, 'getClient').mockResolvedValue({ post } as never);
      const history = { ...createHistory(1), currencyId };
      const result = await service['fetchSwapHistoryStateTx']({
        currentSwapTxHistory: history,
        isPrivateSendHistory: false,
      });
      expect(post).toHaveBeenCalledWith(
        '/swap/v1/state-tx',
        expect.objectContaining({ txId: '0x1' }),
        {
          headers: currencyId
            ? { 'x-onekey-request-currency': currencyId }
            : undefined,
        },
      );
      expect(result.gasFeeFiatValue).toBe('0.12');
      expect(history.currencyId).toBe(currencyId);
    },
  );
});
