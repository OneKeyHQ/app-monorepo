import type {
  ILocalWalletAccount,
  ILocalWalletCapability,
} from '../vaults/localWallet/types';

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

const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: (params: { networkId: string }) =>
    mockGetVaultSettings(params) as Promise<{ localWallet?: unknown }>,
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('Privacy Mode enabled-account ceiling', () => {
  const networkId = 'zec--0';

  const account = (
    index: number,
    ufvk: string,
    syncEnabled: boolean,
  ): ILocalWalletAccount => ({
    accountId: `hd-1--m/44'/133'/${index}'`,
    runtimeKey: 'main',
    accountRuntimeKey: ufvk,
    syncEnabled,
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService({
    accounts,
    maxEnabledAccounts,
  }: {
    accounts: ILocalWalletAccount[];
    maxEnabledAccounts?: number;
  }) {
    mockGetVaultSettings.mockResolvedValue({
      localWallet: { maxEnabledAccounts },
    });
    const enableAccount = jest.fn(async () => undefined);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
        enableAccount,
        listAccounts: async () => ({ accounts, cleanupAccountIds: [] }),
      }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        enableLocalWalletAccount: (params: {
          networkId: string;
          accountId: string;
        }) => Promise<void>;
      },
      { backgroundApi: {} },
    );
    return { enableAccount, service };
  }

  it('refuses a sixth scanning identity', async () => {
    const { enableAccount, service } = createService({
      maxEnabledAccounts: 5,
      accounts: [0, 1, 2, 3, 4].map((i) => account(i, `key-${i}`, true)),
    });

    await expect(
      service.enableLocalWalletAccount({
        networkId,
        accountId: "hd-1--m/44'/133'/9'",
      }),
    ).rejects.toThrow(/limited to 5 accounts/i);
    expect(enableAccount).not.toHaveBeenCalled();
  });

  it('still enables an alias of a key that is already scanning', async () => {
    // Two app accounts, one viewing key: the scanner trial-decrypts once, so
    // the alias costs nothing and must not be refused at the ceiling.
    const { enableAccount, service } = createService({
      maxEnabledAccounts: 5,
      accounts: [
        ...[0, 1, 2, 3, 4].map((i) => account(i, `key-${i}`, true)),
        account(9, 'key-0', false),
      ],
    });

    await service.enableLocalWalletAccount({
      networkId,
      accountId: "hd-1--m/44'/133'/9'",
    });
    expect(enableAccount).toHaveBeenCalledTimes(1);
  });

  it('counts keys rather than accounts when several aliases are enabled', async () => {
    const { enableAccount, service } = createService({
      maxEnabledAccounts: 5,
      accounts: [
        account(0, 'key-0', true),
        account(1, 'key-0', true),
        account(2, 'key-0', true),
        account(3, 'key-1', true),
      ],
    });

    await service.enableLocalWalletAccount({
      networkId,
      accountId: "hd-1--m/44'/133'/9'",
    });
    expect(enableAccount).toHaveBeenCalledTimes(1);
  });

  it('does not gate a chain that declares no ceiling', async () => {
    const { enableAccount, service } = createService({
      accounts: Array.from({ length: 20 }, (_, i) =>
        account(i, `key-${i}`, true),
      ),
    });

    await service.enableLocalWalletAccount({
      networkId,
      accountId: "hd-1--m/44'/133'/99'",
    });
    expect(enableAccount).toHaveBeenCalledTimes(1);
  });
});
