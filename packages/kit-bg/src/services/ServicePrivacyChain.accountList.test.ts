jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

const TREZOR = "m/44'/128'/$$INDEX$$'";
const CAKE = "m/44'/128'/$$INDEX$$'/0/0";

function account(index: number, template: string, suffix: string) {
  return {
    id: `hd-1--${suffix}${index}`,
    name: `Account #${index + 1}`,
    impl: 'xmr',
    createAtNetwork: 'xmr--0',
    template,
    indexedAccountId: `hd-1--${index}`,
  };
}

function createService(accounts: ReturnType<typeof account>[]) {
  return Object.assign(
    Object.create(ServicePrivacyChain.prototype) as {
      listLocalWalletAccounts: () => Promise<
        { accountName: string; deriveLabel?: string }[]
      >;
    },
    {
      getLocalWalletNetworkIds: async () => ['xmr--0'],
      backgroundApi: {
        serviceAccount: {
          getAllAccounts: async () => ({ accounts }),
          getWallets: async () => ({
            wallets: [{ id: 'hd-1', name: 'Wallet 1' }],
          }),
        },
        serviceNetwork: {
          getDeriveInfoItemsOfNetwork: async () => [
            { item: { template: TREZOR }, label: 'Trezor', value: 'default' },
            { item: { template: CAKE }, label: 'Cake Wallet', value: 'cake' },
          ],
        },
      },
    },
  );
}

describe('privacy account list', () => {
  it('groups accounts by derive type, default first, then by index', async () => {
    const service = createService([
      account(0, TREZOR, 't'),
      account(0, CAKE, 'c'),
      account(1, CAKE, 'c'),
      account(1, TREZOR, 't'),
    ]);
    const listed = await service.listLocalWalletAccounts();
    expect(listed.map((a) => `${a.deriveLabel} ${a.accountName}`)).toEqual([
      'Trezor Account #1',
      'Trezor Account #2',
      'Cake Wallet Account #1',
      'Cake Wallet Account #2',
    ]);
  });
});
