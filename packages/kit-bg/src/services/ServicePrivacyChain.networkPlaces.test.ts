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

it('groups a network’s data holders by key, as its limit counts them', async () => {
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IPlacesService,
    {
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            listNetworkDataHolders: async () => [
              { accountId: 'hd-1--0', identity: 'key-a' },
              // The hardware twin of the account above.
              { accountId: 'hw-1--0', identity: 'key-a' },
              { accountId: 'hd-2--0', identity: 'key-b' },
            ],
          },
        },
        serviceAccount: {
          getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
            address: `address-of-${accountId}`,
          }),
        },
      },
    },
  );

  await expect(
    service.getLocalWalletNetworkPlaces({ networkId: 'xmr--0' }),
  ).resolves.toEqual({
    groups: [
      { accountIds: ['hd-1--0', 'hw-1--0'], address: 'address-of-hd-1--0' },
      { accountIds: ['hd-2--0'], address: 'address-of-hd-2--0' },
    ],
  });
});
