import type {
  ILocalWalletAccount,
  ILocalWalletCapability,
} from '../vaults/localWallet/types';
import type { Mutex } from 'async-mutex';

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
    const enableAccount = jest.fn(
      async (_params: { accountId: string }) => undefined,
    );
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
      { backgroundApi: {}, enableMutexByNetwork: new Map<string, Mutex>() },
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

  it('serializes concurrent enables before checking the remaining slot', async () => {
    const accounts = [
      ...[0, 1, 2, 3].map((i) => account(i, `key-${i}`, true)),
      account(4, 'key-4', false),
      account(5, 'key-5', false),
    ];
    const { enableAccount, service } = createService({
      accounts,
      maxEnabledAccounts: 5,
    });
    let releaseFirst: (() => void) | undefined;
    const firstReady = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    enableAccount.mockImplementation(async ({ accountId }) => {
      markStarted?.();
      await firstReady;
      const enabled = accounts.find(
        (candidate) => candidate.accountId === accountId,
      );
      if (enabled) enabled.syncEnabled = true;
    });
    const first = service.enableLocalWalletAccount({
      networkId,
      accountId: accounts[4].accountId,
    });
    const second = service.enableLocalWalletAccount({
      networkId,
      accountId: accounts[5].accountId,
    });
    const results = Promise.allSettled([first, second]);
    await started;
    releaseFirst?.();

    expect(await results).toEqual([
      { status: 'fulfilled', value: undefined },
      {
        status: 'rejected',
        reason: expect.objectContaining({
          message: expect.stringMatching(/limited to 5 accounts/i),
        }),
      },
    ]);
    expect(enableAccount).toHaveBeenCalledTimes(1);
    expect(accounts.filter((candidate) => candidate.syncEnabled)).toHaveLength(
      5,
    );
  });
});

describe('Privacy Mode slot usage reporting', () => {
  const networkId = 'zec--0';

  const account = (
    accountId: string,
    ufvk: string,
    syncEnabled = true,
  ): ILocalWalletAccount => ({
    accountId,
    runtimeKey: 'main',
    accountRuntimeKey: ufvk,
    syncEnabled,
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createService({
    accounts,
    visibleAccountIds,
    maxEnabledAccounts,
  }: {
    accounts: ILocalWalletAccount[];
    visibleAccountIds: string[];
    maxEnabledAccounts?: number;
  }) {
    mockGetVaultSettings.mockResolvedValue({
      localWallet: { maxEnabledAccounts },
    });
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: (): Partial<ILocalWalletCapability> => ({
        listAccounts: async () => ({ accounts, cleanupAccountIds: [] }),
      }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        getLocalWalletSlotUsage: (params: { networkId: string }) => Promise<{
          used: number;
          max?: number;
          occupants: { accountId: string; aliasCount: number }[];
          hiddenCount: number;
        }>;
      },
      {
        backgroundApi: {},
        listLocalWalletAccounts: async () =>
          visibleAccountIds.map((accountId) => ({
            accountId,
            accountName: `name-${accountId}`,
            walletId: 'hd-1',
            walletName: 'Wallet 1',
            networkId,
          })),
      },
    );
  }

  it('counts viewing identities and collapses their aliases into one slot', async () => {
    const service = createService({
      maxEnabledAccounts: 5,
      accounts: [
        account('a', 'key-0'),
        account('b', 'key-0'),
        account('c', 'key-1'),
        account('d', 'key-2', false),
      ],
      visibleAccountIds: ['a', 'b', 'c', 'd'],
    });

    await expect(
      service.getLocalWalletSlotUsage({ networkId }),
    ).resolves.toMatchObject({
      used: 2,
      max: 5,
      hiddenCount: 0,
    });
    const { occupants } = await service.getLocalWalletSlotUsage({ networkId });
    expect(occupants).toHaveLength(2);
    expect(occupants.find((o) => o.accountId === 'a')?.aliasCount).toBe(2);
  });

  // A locked passphrase wallet still holds its slot, and this page cannot
  // offer to free it -- saying "3 of 5" while the service refuses the fourth
  // is exactly the confusion this count exists to prevent.
  it('counts a slot it cannot show when no visible wallet owns it', async () => {
    const service = createService({
      maxEnabledAccounts: 5,
      accounts: [account('a', 'key-0'), account('hidden', 'key-9')],
      visibleAccountIds: ['a'],
    });

    await expect(
      service.getLocalWalletSlotUsage({ networkId }),
    ).resolves.toMatchObject({ used: 2, hiddenCount: 1 });
    const { occupants } = await service.getLocalWalletSlotUsage({ networkId });
    expect(occupants.map((o) => o.accountId)).toEqual(['a']);
  });

  it('reports no ceiling when the chain configures none', async () => {
    const service = createService({
      accounts: [account('a', 'key-0')],
      visibleAccountIds: ['a'],
    });

    await expect(
      service.getLocalWalletSlotUsage({ networkId }),
    ).resolves.toMatchObject({ used: 1, max: undefined });
  });
});
