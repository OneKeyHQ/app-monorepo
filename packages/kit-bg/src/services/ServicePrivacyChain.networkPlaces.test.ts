jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IPlacesService = {
  getLocalWalletNetworkPlaces: (params: {
    networkId: string;
  }) => Promise<import('./ServicePrivacyChain').ILocalWalletNetworkPlaces>;
};

function createService({
  holders,
  listedWalletIds,
  getDBAccountSafe,
}: {
  holders: { accountId: string; identity: string }[];
  listedWalletIds: string[];
  getDBAccountSafe: (params: {
    accountId: string;
  }) => Promise<{ address: string } | null>;
}) {
  return Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IPlacesService,
    {
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            listNetworkDataHolders: async () => holders,
          },
        },
        serviceAccount: {
          getWallets: async () => ({
            wallets: listedWalletIds.map((id) => ({ id })),
          }),
          getDBAccountSafe,
        },
      },
    },
  );
}

it('takes a group’s address from an account still in the store', async () => {
  const service = createService({
    holders: [
      // Removed, not yet cleaned up: no account record left.
      { accountId: 'hw-1--0', identity: 'key-a' },
      { accountId: 'hd-1--0', identity: 'key-a' },
    ],
    listedWalletIds: ['hw-1', 'hd-1'],
    getDBAccountSafe: async ({ accountId }) =>
      accountId === 'hw-1--0' ? null : { address: 'shared-address' },
  });

  await expect(
    service.getLocalWalletNetworkPlaces({ networkId: 'xmr--0' }),
  ).resolves.toEqual({
    groups: [{ accountIds: ['hw-1--0', 'hd-1--0'], address: 'shared-address' }],
  });
});

it('groups a network’s data holders by key, as its limit counts them', async () => {
  const service = createService({
    holders: [
      { accountId: 'hd-1--0', identity: 'key-a' },
      // The hardware twin of the account above.
      { accountId: 'hw-1--0', identity: 'key-a' },
      { accountId: 'hd-2--0', identity: 'key-b' },
    ],
    listedWalletIds: ['hd-1', 'hw-1', 'hd-2'],
    getDBAccountSafe: async ({ accountId }) => ({
      address: `address-of-${accountId}`,
    }),
  });

  await expect(
    service.getLocalWalletNetworkPlaces({ networkId: 'xmr--0' }),
  ).resolves.toEqual({
    groups: [
      { accountIds: ['hd-1--0', 'hw-1--0'], address: 'address-of-hd-1--0' },
      { accountIds: ['hd-2--0'], address: 'address-of-hd-2--0' },
    ],
  });
});

it('never gives the address of a wallet not open now', async () => {
  const service = createService({
    holders: [
      // A hidden wallet no longer kept: still holding data, not listed.
      { accountId: 'hw-hidden--0', identity: 'key-a' },
      { accountId: 'hw-hidden--1', identity: 'key-b' },
      // Its key is shared by a listed wallet, which may show the address.
      { accountId: 'hd-1--1', identity: 'key-b' },
    ],
    listedWalletIds: ['hd-1'],
    getDBAccountSafe: async ({ accountId }) => ({
      address: `address-of-${accountId}`,
    }),
  });

  await expect(
    service.getLocalWalletNetworkPlaces({ networkId: 'xmr--0' }),
  ).resolves.toEqual({
    groups: [
      { accountIds: ['hw-hidden--0'], address: undefined },
      {
        accountIds: ['hw-hidden--1', 'hd-1--1'],
        address: 'address-of-hd-1--1',
      },
    ],
  });
});
