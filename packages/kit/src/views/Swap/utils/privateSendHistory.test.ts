import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { maybeOpenPrivateSendHistoryDetail } from './privateSendHistory';

const mockGetSwapHistory = jest.fn<
  Promise<ISwapTxHistory | undefined>,
  [{ txId: string }]
>();
const mockFetchOrderDetail = jest.fn<
  Promise<ISwapTxHistory>,
  [{ item: ISwapTxHistory }]
>();
const mockUpdateSwapHistory = jest.fn<
  Promise<void>,
  [ISwapTxHistory, { shouldShowToast: boolean }]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      getSwapHistoryByTxId: (params: { txId: string }) =>
        mockGetSwapHistory(params),
      fetchPrivateSendOrderDetailHistoryItem: (params: {
        item: ISwapTxHistory;
      }) => mockFetchOrderDetail(params),
      updateSwapHistoryItem: (
        item: ISwapTxHistory,
        options: { shouldShowToast: boolean },
      ) => mockUpdateSwapHistory(item, options),
    },
    serviceToken: {
      getNativeTokenAddress: jest.fn().mockResolvedValue(''),
      fetchTokensDetails: jest.fn().mockResolvedValue([]),
    },
  },
}));

const nativeToken = {
  networkId: 'evm--1',
  address: '',
  name: 'Ethereum',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const network = {
  id: nativeToken.networkId,
  name: nativeToken.name,
  symbol: nativeToken.symbol,
  logoURI: 'eth-icon',
};

function createHistory(provider = 'SwapQuickeXPrivateSend'): ISwapTxHistory {
  const token = { ...nativeToken, contractAddress: '' };
  return {
    protocol: EProtocolOfExchange.PRIVATE_SEND,
    status: ESwapTxHistoryStatus.PENDING,
    currency: '$',
    currencyId: 'usd',
    accountInfo: {
      sender: { accountId: 'account-id', networkId: nativeToken.networkId },
      receiver: { networkId: nativeToken.networkId },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: 'deposit-tx',
      sender: 'sender',
      receiver: 'receiver',
      gasFeeInNative: '0.000006086783724',
      gasFeeFiatValue: '0.01423376113506228',
    },
    swapInfo: {
      provider: { provider, providerName: provider },
      orderId: 'private-order',
      instantRate: '1',
    },
    date: { created: 1, updated: 1 },
  };
}

function createWalletHistory(
  overrides: Partial<IAccountHistoryTx['decodedTx']> = {},
): IAccountHistoryTx {
  return {
    id: 'history-id',
    decodedTx: {
      txid: 'deposit-tx',
      owner: 'sender',
      signer: 'sender',
      accountId: 'account-id',
      networkId: nativeToken.networkId,
      nonce: 0,
      status: EDecodedTxStatus.Confirmed,
      actions: [],
      extraInfo: null,
      totalFeeInNative: '0.000004505955972000',
      totalFeeFiatValue: '0.01053704286184284',
      payload: {
        type: EOnChainHistoryTxType.PrivateSend,
        value: '1',
        label: 'Private Send',
        privateSend: { originalRecipient: 'receiver' },
      },
      ...overrides,
    },
  };
}

async function openDetail(historyTx: IAccountHistoryTx, currencySymbol = '$') {
  type IPushModal = Parameters<
    typeof maybeOpenPrivateSendHistoryDetail
  >[0]['navigation']['pushModal'];
  const pushModal = jest.fn<ReturnType<IPushModal>, Parameters<IPushModal>>();
  await expect(
    maybeOpenPrivateSendHistoryDetail({
      historyTx,
      navigation: { pushModal },
      accountId: 'account-id',
      network,
      tokenInfo: nativeToken,
      currencySymbol,
    }),
  ).resolves.toBe(true);
  expect(pushModal).toHaveBeenCalledTimes(1);
  const item = pushModal.mock.calls[0][1].params.txHistoryList?.[0];
  if (!item) {
    throw new OneKeyLocalError('Private Send detail did not receive a history');
  }
  return item;
}

describe('Private Send detail fee replay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSwapHistory.mockResolvedValue(createHistory());
    mockFetchOrderDetail.mockImplementation(async ({ item }) => item);
  });

  it.each(
    ['SwapQuickeXPrivateSend', 'SwapRocketXPrivateSend'].flatMap((provider) =>
      [EDecodedTxStatus.Confirmed, EDecodedTxStatus.Failed].map((status) => ({
        provider,
        status,
      })),
    ),
  )(
    'replaces the estimate with paid fees for $provider ($status) without completing the provider order',
    async ({ provider, status }) => {
      mockGetSwapHistory.mockResolvedValue(createHistory(provider));
      const walletHistory = createWalletHistory({ status });
      const item = await openDetail(walletHistory);
      expect(item.txInfo.gasFeeInNative).toBe(
        walletHistory.decodedTx.totalFeeInNative,
      );
      expect(item.txInfo.gasFeeFiatValue).toBe(
        walletHistory.decodedTx.totalFeeFiatValue,
      );
      expect(item.status).toBe(ESwapTxHistoryStatus.PENDING);
      expect(mockUpdateSwapHistory).toHaveBeenCalledWith(item, {
        shouldShowToast: false,
      });
    },
  );

  it.each(['0', '-0.001'])(
    'accepts a finite confirmed fee of %s',
    async (fee) => {
      const item = await openDetail(
        createWalletHistory({ totalFeeInNative: fee, totalFeeFiatValue: fee }),
      );
      expect(item.txInfo.gasFeeInNative).toBe(fee);
      expect(item.txInfo.gasFeeFiatValue).toBe(fee);
    },
  );

  it.each([undefined, 'NaN', 'Infinity'])(
    'keeps the known fee when the confirmed replay contains %s',
    async (fee) => {
      const item = await openDetail(
        createWalletHistory({ totalFeeInNative: fee, totalFeeFiatValue: fee }),
      );
      expect(item.txInfo).toEqual(createHistory().txInfo);
    },
  );

  it('does not replace a known zero fee with a pending estimate', async () => {
    const stored = createHistory();
    stored.txInfo.gasFeeInNative = '0';
    stored.txInfo.gasFeeFiatValue = '0';
    mockGetSwapHistory.mockResolvedValue(stored);
    const item = await openDetail(
      createWalletHistory({ status: EDecodedTxStatus.Pending }),
    );
    expect(item.txInfo).toEqual(stored.txInfo);
  });

  it('fills missing fees before confirmation', async () => {
    const stored = createHistory();
    stored.txInfo.gasFeeInNative = undefined;
    stored.txInfo.gasFeeFiatValue = undefined;
    mockGetSwapHistory.mockResolvedValue(stored);
    const history = createWalletHistory({ status: EDecodedTxStatus.Pending });
    const item = await openDetail(history);
    expect(item.txInfo.gasFeeInNative).toBe(history.decodedTx.totalFeeInNative);
    expect(item.txInfo.gasFeeFiatValue).toBe(
      history.decodedTx.totalFeeFiatValue,
    );
  });

  it('keeps the stored fiat denomination when replaying another currency', async () => {
    const item = await openDetail(createWalletHistory(), '€');
    expect(item.txInfo.gasFeeInNative).toBe(
      createWalletHistory().decodedTx.totalFeeInNative,
    );
    expect(item.txInfo.gasFeeFiatValue).toBe(
      createHistory().txInfo.gasFeeFiatValue,
    );
    expect(item.currencyId).toBe('usd');
  });
});
