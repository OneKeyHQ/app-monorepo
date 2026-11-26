import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const mockRegisteredAccounts = jest.fn<Promise<{ accountId: string }[]>, []>();
jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    starknetPrivacy: {
      getRegisteredAccounts: () => mockRegisteredAccounts(),
    },
  },
}));

const mockChainModuleLoad = jest.fn(() => ({}));
jest.mock('../../vaults/impls/starknet/sdkStarknet/consts', () =>
  mockChainModuleLoad(),
);
jest.mock('../../vaults/impls/starknet/strk20Adapter', () =>
  mockChainModuleLoad(),
);
jest.mock('../../vaults/impls/starknet/strk20Protocol', () =>
  mockChainModuleLoad(),
);
jest.mock('../../vaults/impls/starknet/utils', () => mockChainModuleLoad());

const previousBackgroundScope = globalThis.$onekeyIsInBackground;
beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});
afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundScope;
});

it.each([{ accounts: [] }, { accounts: [{ accountId: 'hw-1--starknet--0' }] }])(
  'keeps the vault implementation out of unlock and cleanup without registered software accounts',
  async ({ accounts }) => {
    mockRegisteredAccounts.mockResolvedValue(accounts);
    const { default: ServiceStarknetPrivacy } =
      await import('../ServiceStarknetPrivacy');
    const service = new ServiceStarknetPrivacy({
      backgroundApi: {} as IBackgroundApi,
    });
    await service.prepareUnlockedViewingKeys();
    await service.clearViewingKeyCache();
    expect(mockRegisteredAccounts).toHaveBeenCalled();
    expect(mockChainModuleLoad).not.toHaveBeenCalled();
  },
);
