/* eslint-disable import/first */
jest.mock('../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { EOnChainHistoryTransferType } from '@onekeyhq/shared/types/history';
import type { IOnChainHistoryTxTransfer } from '@onekeyhq/shared/types/history';

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

describe('buildHistoryTransfer', () => {
  const vault = Object.create(VaultBase.prototype) as VaultBase;
  const entry = (
    overrides: Partial<IOnChainHistoryTxTransfer>,
  ): IOnChainHistoryTxTransfer => ({
    type: EOnChainHistoryTransferType.Transfer,
    from: 'bc1-from',
    to: 'bc1-to',
    token: '',
    key: 'btc--0_',
    amount: '1',
    label: 'Transfer',
    isOwn: true,
    ...overrides,
  });

  it('keeps an ordinary transfer exactly as before', () => {
    expect(
      vault.buildHistoryTransfer({
        transfer: entry({}),
        tokens: {},
        nfts: {},
      }),
    ).toStrictEqual({
      from: 'bc1-from',
      to: 'bc1-to',
      tokenIdOnNetwork: '',
      amount: '1',
      label: 'Transfer',
      isOwn: true,
      isShielded: false,
      icon: '',
      name: '',
      symbol: '',
      isNFT: false,
      isNative: false,
      price: '0',
    });
  });

  it('marks a shielded note by pool instead of exposing its label as an address', () => {
    expect(
      vault.buildHistoryTransfer({
        transfer: entry({
          type: EOnChainHistoryTransferType.Shielded,
          from: '',
          to: '',
          address: 'Shielded',
          label: 'Shielded',
          poolId: 4,
        }),
        tokens: {},
        nfts: {},
      }),
    ).toMatchObject({
      from: '',
      to: '',
      isShielded: true,
      shieldedFrom: { poolId: 4 },
      shieldedTo: { poolId: 4 },
    });
  });
});
