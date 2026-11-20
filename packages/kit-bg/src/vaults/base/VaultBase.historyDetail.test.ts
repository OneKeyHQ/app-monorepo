/* eslint-disable import/first */
jest.mock('../../dbs/local/localDbInstance');

import {
  EProtocolOfExchange,
  ESwapQuoteSource,
  type ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { VaultBase } from './VaultBase';

function createVault() {
  const post = jest.fn(async () => ({ data: { data: {} } }));
  const vault = Object.assign(Object.create(VaultBase.prototype) as VaultBase, {
    backgroundApi: {
      serviceGas: {
        getClient: async () => ({ post }),
        getOneKeyIdAuthHeaders: async () => ({}),
      },
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
    },
  });
  return { vault, post };
}

it.each([
  {
    scenario: 'Dust Sweep',
    quoteSource: ESwapQuoteSource.SWEEP,
    payAmount: '15.15',
    receiveAmount: '0.01',
  },
  {
    scenario: 'scaled Swap',
    payAmount: '15.15',
    receiveAmount: '0.02',
    receiveMultiplier: '2',
  },
  {
    scenario: 'same EVM fee with a differently cased address and no multiplier',
    payAmount: '33',
    payMultiplier: '3',
    feeAmount: '1',
    feeAddressIsLowercase: true,
    receiveAmount: '0.02',
    receiveMultiplier: '2',
  },
])(
  'decodes the same signed amounts for $scenario',
  async ({
    quoteSource,
    payAmount,
    payMultiplier = '1.5',
    feeAmount = '0.1',
    feeAddressIsLowercase,
    receiveAmount,
    receiveMultiplier,
  }) => {
    const { vault } = createVault();
    const display = jest
      .spyOn(vault, 'buildTxTransferAssetAction')
      .mockResolvedValue({
        type: EDecodedTxActionType.ASSET_TRANSFER,
      });
    const networkId = 'evm--56';
    const fromToken = {
      networkId,
      symbol: 'AAPLB',
      contractAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      decimals: 18,
      balanceMultiplier: payMultiplier,
      price: '1',
    };
    const toToken = {
      networkId,
      symbol: receiveMultiplier ? 'TSLAB' : 'BNB',
      contractAddress: receiveMultiplier ? '0xreceive' : '',
      decimals: 18,
      isNative: !receiveMultiplier,
      balanceMultiplier: receiveMultiplier,
    };
    const fee = {
      amount: feeAmount,
      token: feeAddressIsLowercase
        ? {
            ...fromToken,
            contractAddress: fromToken.contractAddress.toLowerCase(),
            balanceMultiplier: undefined,
          }
        : fromToken,
    };
    const swapInfo: ISwapTxInfo = {
      quoteSource,
      protocol: EProtocolOfExchange.SWAP,
      accountAddress: '0xaccount',
      receivingAddress: '0xaccount',
      sender: { amount: '10', token: fromToken, accountInfo: { networkId } },
      receiver: { amount: '0.01', token: toToken, accountInfo: { networkId } },
      swapBuildResData: {
        result: {
          info: { provider: 'SwapOKX', providerName: 'OKX' },
          fromTokenInfo: fromToken,
          toTokenInfo: toToken,
          fee: {
            percentageFee: 0,
            otherFeeInfos: [fee],
          },
        },
      },
    };

    await vault.buildInternalSwapAction({ swapInfo });
    const { transfers } = display.mock.calls[0][0];
    expect(transfers).toMatchObject([
      { amount: payAmount },
      { amount: receiveAmount },
    ]);
    expect(transfers[0].balanceMultiplier).toBe(payMultiplier);
    expect(transfers[1].balanceMultiplier).toBe(receiveMultiplier);
    expect(swapInfo.sender.amount).toBe('10');
    expect(swapInfo.receiver.amount).toBe('0.01');
    expect(fee.amount).toBe(feeAmount);
  },
);

it.each([
  { feeMultiplier: '3', displayAmount: '3', displayMultiplier: '3' },
  { feeMultiplier: '1', displayAmount: '1', displayMultiplier: undefined },
  {
    feeMultiplier: undefined,
    displayAmount: '1',
    displayMultiplier: undefined,
  },
])(
  'decodes a separate swap fee for display (multiplier: $feeMultiplier)',
  async ({ feeMultiplier, displayAmount, displayMultiplier }) => {
    const { vault } = createVault();
    const display = jest
      .spyOn(vault, 'buildTxTransferAssetAction')
      .mockResolvedValue({ type: EDecodedTxActionType.ASSET_TRANSFER });
    const fromToken = {
      networkId: 'evm--56',
      symbol: 'PAY',
      contractAddress: '0xpay',
      decimals: 6,
    };
    const toToken = { ...fromToken, symbol: 'OUT', contractAddress: '0xout' };
    const feeToken = {
      ...fromToken,
      symbol: 'FEE',
      contractAddress: '0xfee',
      price: '2',
      balanceMultiplier: feeMultiplier,
    };
    const fee = { token: feeToken, amount: '1' };
    const swapInfo: ISwapTxInfo = {
      protocol: EProtocolOfExchange.SWAP,
      accountAddress: '0xaccount',
      receivingAddress: '0xaccount',
      sender: {
        amount: '10',
        token: fromToken,
        accountInfo: { networkId: fromToken.networkId },
      },
      receiver: {
        amount: '7',
        token: toToken,
        accountInfo: { networkId: toToken.networkId },
      },
      swapBuildResData: {
        result: {
          info: { provider: 'SwapOKX', providerName: 'OKX' },
          fromTokenInfo: fromToken,
          toTokenInfo: toToken,
          fee: { percentageFee: 0, otherFeeInfos: [fee] },
        },
      },
    };

    await vault.buildInternalSwapAction({ swapInfo });

    const { transfers } = display.mock.calls[0][0];
    expect(transfers).toMatchObject([
      { symbol: 'FEE', amount: displayAmount },
      { symbol: 'PAY', amount: '10' },
      { symbol: 'OUT', amount: '7' },
    ]);
    expect(transfers[0].balanceMultiplier).toBe(displayMultiplier);
    expect(fee.amount).toBe('1');
    expect(swapInfo.sender.amount).toBe('10');
    expect(swapInfo.receiver.amount).toBe('7');
  },
);

it('keeps the wallet I/O display flag and the pool tab internal', async () => {
  const { vault, post } = createVault();
  await vault.fetchAccountHistoryDetailByApi({
    accountId: 'synthetic-account',
    networkId: 'zec--0',
    txid: 'aa'.repeat(32),
    privacyChainPoolId: 4,
    withUTXOs: true,
  });
  expect(post).toHaveBeenCalledWith(
    '/wallet/v1/account/history/detail',
    { networkId: 'zec--0', txid: 'aa'.repeat(32) },
    { headers: {} },
  );
});

it('sends every other field of a non-privacy chain request unchanged', async () => {
  const { vault, post } = createVault();
  const body = {
    networkId: 'btc--0',
    txid: 'bb'.repeat(32),
    accountAddress: 'bc1q-synthetic',
    xpub: 'xpub-synthetic',
    accountAddressArray: ['bc1q-a', 'bc1q-b'],
  };
  await vault.fetchAccountHistoryDetailByApi({
    accountId: 'synthetic-account',
    ...body,
  });
  expect(post).toHaveBeenCalledWith('/wallet/v1/account/history/detail', body, {
    headers: {},
  });
  const [, sent] = post.mock.calls[0] as unknown as [string, object];
  expect(Object.keys(sent)).toEqual(Object.keys(body));
});
