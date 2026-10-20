/* eslint-disable import/first */
jest.mock('../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

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
