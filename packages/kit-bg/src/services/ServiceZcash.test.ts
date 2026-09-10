jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthroughDecorator =
    () =>
    (
      _target: unknown,
      _propertyKey?: string,
      descriptor?: PropertyDescriptor,
    ) =>
      descriptor;

  return {
    ...actual,
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
  };
});

const mockGetChainOnlyVault = jest.fn();
const mockGetVault = jest.fn();

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: mockGetChainOnlyVault,
    getVault: mockGetVault,
  },
}));

const { getZcashLifecycleMutex } = jest.requireActual<
  typeof import('../vaults/impls/zcash/lifecycle')
>('../vaults/impls/zcash/lifecycle');

const ServiceZcash = require('./ServiceZcash')
  .default as typeof import('./ServiceZcash').default;

const accountId = "hd-1--m/44'/133'/0'";

function createService({
  impl = 'zec',
  account = { id: accountId, impl: 'zec' },
  privacyModeEnabled = false,
}: {
  impl?: string;
  account?: { id: string; impl: string } | null;
  privacyModeEnabled?: boolean;
} = {}) {
  const backgroundApi = {
    serviceNetwork: {
      getNetworkSafe: jest.fn().mockResolvedValue({ id: 'zec--0', impl }),
    },
    serviceAccount: {
      getDBAccountSafe: jest.fn().mockResolvedValue(account),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest
        .fn()
        .mockResolvedValue({ password: 'test-password' }),
    },
    servicePrivacyChain: { onLocalWalletAccountsChanged: jest.fn() },
    simpleDb: {
      zcash: {
        getPrivacyModeState: jest.fn().mockResolvedValue({ intent: 'off' }),
        isPrivacyModeEnabled: jest.fn().mockResolvedValue(privacyModeEnabled),
        beginPrivacyModeEnable: jest.fn(),
        completePrivacyModeEnable: jest.fn(),
        beginPrivacyModeDisable: jest.fn(),
        completePrivacyModeDisable: jest.fn(),
        getAccountMeta: jest.fn().mockResolvedValue({
          ufvk: 'synthetic-ufvk',
          birthdayHeight: 2_000_000,
        }),
      },
    },
  };
  return {
    backgroundApi,
    service: new ServiceZcash({ backgroundApi }),
  };
}

describe('ServiceZcash context and receive gating', () => {
  beforeEach(() => {
    mockGetChainOnlyVault.mockReset();
    mockGetVault.mockReset();
  });

  it('rejects a non-Zcash network before writing privacy state', async () => {
    const { backgroundApi, service } = createService({ impl: 'btc' });

    await expect(
      service.enablePrivacyMode({
        networkId: 'btc--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('network is not compatible');
    expect(
      backgroundApi.servicePassword.promptPasswordVerifyByAccount,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('rejects a removed account before writing privacy state', async () => {
    const { backgroundApi, service } = createService({ account: null });

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('existing HD accounts');
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('rejects an HD account derived for another chain', async () => {
    const { backgroundApi, service } = createService({
      account: { id: accountId, impl: 'btc' },
    });

    await expect(
      service.enablePrivacyMode({
        networkId: 'zec--0',
        accountId,
        birthdayHeight: 1,
      }),
    ).rejects.toThrow('existing HD accounts');
    expect(
      backgroundApi.simpleDb.zcash.beginPrivacyModeEnable,
    ).not.toHaveBeenCalled();
  });

  it('does not expose a Unified Address while Privacy Mode is off', async () => {
    const getLocalWalletAccountMeta = jest.fn();
    mockGetChainOnlyVault.mockResolvedValue({ getLocalWalletAccountMeta });
    const { service } = createService({ privacyModeEnabled: false });

    await expect(
      service.getLocalWalletAccountMeta({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBeUndefined();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('does not expose shielded balances while Privacy Mode is off', async () => {
    const getLocalWalletBalance = jest.fn();
    mockGetChainOnlyVault.mockResolvedValue({ getLocalWalletBalance });
    const { service } = createService({ privacyModeEnabled: false });

    await expect(
      service.getLocalWalletBalance({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBeNull();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('returns viewing metadata only while Privacy Mode is enabled', async () => {
    const meta = { unifiedAddress: 'u1-test' };
    const getLocalWalletAccountMeta = jest.fn().mockResolvedValue(meta);
    mockGetChainOnlyVault.mockResolvedValue({ getLocalWalletAccountMeta });
    const { service } = createService({ privacyModeEnabled: true });

    await expect(
      service.getLocalWalletAccountMeta({
        networkId: 'zec--0',
        accountId,
      }),
    ).resolves.toBe(meta);
  });
});

describe('ServiceZcash privacy lifecycle', () => {
  it('disables with a real non-reentrant lifecycle mutex and releases it for the next operation', async () => {
    const { backgroundApi, service } = createService();
    backgroundApi.simpleDb.zcash.getPrivacyModeState.mockResolvedValue({
      intent: 'on',
      birthdayHeight: 2_000_000,
    });
    const mutex = getZcashLifecycleMutex('synthetic-ufvk');
    const checkBroadcasts = jest.fn(async () => {
      expect(mutex.isLocked()).toBe(true);
    });
    const checkWithLock = jest.fn(() => mutex.runExclusive(checkBroadcasts));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        getSyncProgress: async () => undefined,
      }),
      zcashAssertNoUnresolvedBroadcast: checkBroadcasts,
      zcashAssertNoUnresolvedBroadcastWithLifecycleLock: checkWithLock,
    });

    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });
    await service.disablePrivacyMode({ networkId: 'zec--0', accountId });

    expect(checkBroadcasts).toHaveBeenCalledTimes(2);
    expect(checkWithLock).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeDisable,
    ).toHaveBeenCalledTimes(2);
    expect(mutex.isLocked()).toBe(false);
  });

  it('queues the enable rescan in the shared sync lane', async () => {
    const { backgroundApi, service } = createService();
    const syncGroup = jest
      .fn()
      .mockResolvedValue({ synced: true, backfillRemaining: true });
    const zcashRetryLocalWalletSetup = jest.fn();
    mockGetVault.mockResolvedValue({
      zcashRetryLocalWalletSetup,
      getLocalWalletCapability: () => ({
        getChainTip: async () => 3_000_000,
        syncGroup,
      }),
    });

    await service.enablePrivacyMode({
      networkId: 'zec--0',
      accountId,
      birthdayHeight: 2_000_000,
    });

    expect(syncGroup).toHaveBeenCalledWith({
      accountIds: [accountId],
      rescanFrom: { accountId, fromHeight: 2_000_000 },
      chainTip: 3_000_000,
    });
    expect(
      backgroundApi.simpleDb.zcash.completePrivacyModeEnable,
    ).toHaveBeenCalledWith({ accountId });
    expect(zcashRetryLocalWalletSetup).toHaveBeenCalledTimes(1);
  });
});
