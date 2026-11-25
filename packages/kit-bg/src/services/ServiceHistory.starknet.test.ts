/* eslint-disable import/first */
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
jest.mock('../states/jotai/atoms', () => ({
  ...jest.requireActual<typeof import('../states/jotai/atoms')>(
    '../states/jotai/atoms',
  ),
  settingsPersistAtom: {
    get: async () => ({ currencyInfo: { id: 'usd' } }),
  },
}));

const mockGetVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: (...args: unknown[]) => mockGetVault(...args) },
}));

import { getVaultSettings } from '../vaults/settings';

const ServiceHistory = require('./ServiceHistory')
  .default as typeof import('./ServiceHistory').default;
const networkId = 'starknet--mainnet';

it('queries backend Starknet history instead of treating the chain as unsupported', async () => {
  mockGetVault.mockResolvedValue({
    fetchAccountHistoryFromLocal: async () => undefined,
    buildFetchHistoryListParams: async () => ({}),
  });
  const post = jest.fn(async () => ({
    data: {
      data: {
        data: [],
        tokens: {},
        nfts: {},
        addressMap: {},
        hasMore: false,
      },
    },
  }));
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as InstanceType<
      typeof ServiceHistory
    >,
    {
      getClient: async () => ({ post }),
      getOneKeyIdAuthHeaders: async () => ({}),
      backgroundApi: {
        serviceNetwork: {
          getVaultSettings: ({ networkId: id }: { networkId: string }) =>
            getVaultSettings({ networkId: id }),
          isCustomNetwork: async () => false,
          getNetwork: async () => ({ backendIndex: false }),
        },
        serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
      },
    },
  );
  await service.fetchAccountOnChainHistory({
    networkId,
    accountId: 'hd-1--test',
    accountAddress: '0x1234',
    page: 2,
    cursor: 'next-page',
    minTimestampMs: 1000,
    maxTimestampMs: 2000,
  });
  expect(post).toHaveBeenCalledWith(
    '/wallet/v1/account/history/list',
    expect.objectContaining({
      networkId,
      accountAddress: '0x1234',
      page: 2,
      cursor: 'next-page',
      minTimestampMs: 1000,
      maxTimestampMs: 2000,
    }),
    expect.any(Object),
  );
});
