/* eslint-disable import/first */
jest.mock('../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { VaultBase } from './VaultBase';

it('keeps the wallet I/O display flag internal and preserves the public API request contract', async () => {
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
  await vault.fetchAccountHistoryDetailByApi({
    accountId: 'synthetic-account',
    networkId: 'zec--0',
    txid: 'aa'.repeat(32),
    privacyChainPoolId: 4,
    withUTXOs: true,
  });
  expect(post).toHaveBeenCalledWith(
    '/wallet/v1/account/history/detail',
    { networkId: 'zec--0', txid: 'aa'.repeat(32), privacyChainPoolId: 4 },
    { headers: {} },
  );
});
