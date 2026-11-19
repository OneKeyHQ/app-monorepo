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
  [ESwapQuoteSource.SWEEP, '15.15', '1.5'],
  [undefined, '10.1', undefined],
])(
  'decodes the same signed amounts for the saved display basis (%s)',
  async (quoteSource, amount, balanceMultiplier) => {
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
      contractAddress: '0xtoken',
      decimals: 18,
      balanceMultiplier: '1.5',
      price: '1',
    };
    const toToken = {
      networkId,
      symbol: 'BNB',
      contractAddress: '',
      decimals: 18,
      isNative: true,
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
            otherFeeInfos: [{ token: fromToken, amount: '0.1' }],
          },
        },
      },
    };

    await vault.buildInternalSwapAction({ swapInfo });
    const { transfers } = display.mock.calls[0][0];
    expect(transfers).toMatchObject([{ amount }, { amount: '0.01' }]);
    expect(transfers[0].balanceMultiplier).toBe(balanceMultiplier);
    expect(swapInfo.sender.amount).toBe('10');
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
