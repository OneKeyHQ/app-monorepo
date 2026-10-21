import type {
  ILocalWalletAccount,
  ILocalWalletAccountState,
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
const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: mockGetChainOnlyVault,
    getVault: mockGetVault,
  },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: (params: { networkId: string }) =>
    mockGetVaultSettings(params) as Promise<{ localWallet?: unknown }>,
}));
const mockGetViewingKey = jest.fn();
const mockSaveViewingKey = jest.fn();
jest.mock('../vaults/localWallet/viewingKeyStore', () => ({
  getLocalWalletViewingKey: (params: unknown) =>
    mockGetViewingKey(params) as Promise<string | undefined>,
  saveLocalWalletViewingKey: (params: unknown) =>
    mockSaveViewingKey(params) as Promise<void>,
  listLocalWalletViewingKeyAccountIds: async () => [],
  removeLocalWalletViewingKeys: async () => undefined,
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = InstanceType<typeof ServicePrivacyChain>;

const networkId = 'zec--0';
// A hidden wallet the user did not keep, next to an ordinary saved one.
const tempWalletId = 'hw-1-passphrase';
const savedWalletId = 'hd-1';
const tempAccountId = `${tempWalletId}--m/44'/133'/0'`;
const savedAccountId = `${savedWalletId}--m/44'/133'/0'`;

function createService({
  tempWalletIds,
  capability,
  overrides = {},
}: {
  tempWalletIds: Set<string>;
  capability: Partial<ILocalWalletCapability>;
  overrides?: Record<string, unknown>;
}) {
  mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
  mockGetChainOnlyVault.mockResolvedValue({
    getLocalWalletCapability: () => capability,
    supportsAccountWalletType: () => true,
  });
  const getWalletSafe = jest.fn(async ({ walletId }: { walletId: string }) => ({
    id: walletId,
    isTemp: tempWalletIds.has(walletId),
  }));
  const service = Object.assign(Object.create(ServicePrivacyChain.prototype), {
    backgroundApi: {
      serviceAccount: {
        getWalletSafe,
        getDBAccountSafe: async ({ accountId }: { accountId: string }) => ({
          id: accountId,
        }),
      },
      servicePassword: {
        hasCachedPassword: async () => true,
        getCachedPassword: async () => 'pw',
      },
    },
    enableMutexByNetwork: new Map<string, Mutex>(),
    repairMutexByAccount: new Map<string, Mutex>(),
    storageUnsupportedNetworkIds: new Set<string>(),
    ...overrides,
  }) as IService;
  return { service, getWalletSafe };
}

const enabledState: ILocalWalletAccountState = {
  enabled: true,
  paused: false,
};

describe('temp wallets cannot turn on privacy', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('refuses to enable a temp-wallet account and writes nothing', async () => {
    const enableAccount = jest.fn(async () => undefined);
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: { enableAccount },
    });

    await expect(
      service.enableLocalWalletAccount({ networkId, accountId: tempAccountId }),
    ).rejects.toThrow('hidden wallets');
    expect(enableAccount).not.toHaveBeenCalled();
  });

  it('allows it once the wallet is kept', async () => {
    const tempWalletIds = new Set([tempWalletId]);
    const enableAccount = jest.fn(async () => undefined);
    const { service } = createService({
      tempWalletIds,
      capability: { enableAccount },
    });
    await expect(
      service.enableLocalWalletAccount({ networkId, accountId: tempAccountId }),
    ).rejects.toThrow();

    tempWalletIds.delete(tempWalletId);
    await service.enableLocalWalletAccount({
      networkId,
      accountId: tempAccountId,
    });

    expect(enableAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: tempAccountId }),
    );
  });

  it('refuses setup retries and rescans for a temp-wallet account', async () => {
    const retryAccountSetup = jest.fn(async () => undefined);
    const rescan = jest.fn(async () => ({ fromHeight: 0 }));
    const rewindAccount = jest.fn(async () => undefined);
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: { retryAccountSetup, rescan, rewindAccount },
    });

    await expect(
      service.retryLocalWalletAccountSetup({
        networkId,
        accountId: tempAccountId,
      }),
    ).rejects.toThrow();
    await expect(
      service.resetLocalChainData({ networkId, accountId: tempAccountId }),
    ).rejects.toThrow();
    await expect(
      service.repairLocalChainData({
        networkId,
        accountId: tempAccountId,
        mode: 'height',
        birthdayHeight: 2_000_000,
      }),
    ).rejects.toThrow();
    await expect(
      service.rescanFromDaysAgo({
        networkId,
        accountId: tempAccountId,
        daysAgo: 3,
      }),
    ).rejects.toThrow();

    expect(retryAccountSetup).not.toHaveBeenCalled();
    expect(rescan).not.toHaveBeenCalled();
    expect(rewindAccount).not.toHaveBeenCalled();
  });

  it('skips temp-wallet accounts when clearing every history cache', async () => {
    const runLocalWalletLifecycle = jest.fn(async () => ({
      failedNetworkIds: [],
    }));
    const accounts: ILocalWalletAccount[] = [tempAccountId, savedAccountId].map(
      (accountId) => ({
        accountId,
        runtimeKey: 'main',
        accountRuntimeKey: accountId,
        syncEnabled: true,
      }),
    );
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: {
        listAccounts: async () => ({ accounts, cleanupAccountIds: [] }),
        getAccountAliases: async ({ accountId }) => [accountId],
      },
      overrides: { runLocalWalletLifecycle },
    });

    await service.clearTransactionHistoryCache({ networkId });

    expect(runLocalWalletLifecycle).toHaveBeenCalledTimes(1);
    expect(runLocalWalletLifecycle).toHaveBeenCalledWith({
      event: 'resetSyncStorage',
      targets: [
        expect.objectContaining({
          networkId,
          accountIds: [savedAccountId],
          runtimeAccountIds: [savedAccountId],
        }),
      ],
    });
  });
});

describe('temp wallets read as privacy unavailable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('answers why an account cannot scan', async () => {
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: {},
    });

    await expect(
      service.getLocalWalletAccountSupport({
        networkId,
        accountId: tempAccountId,
      }),
    ).resolves.toBe('tempWallet');
    await expect(
      service.getLocalWalletAccountSupport({
        networkId,
        accountId: savedAccountId,
      }),
    ).resolves.toBe('supported');

    mockGetChainOnlyVault.mockResolvedValue({
      supportsAccountWalletType: () => false,
    });
    await expect(
      service.getLocalWalletAccountSupport({
        networkId,
        accountId: tempAccountId,
      }),
    ).resolves.toBe('unsupported');

    mockGetVaultSettings.mockResolvedValue({});
    await expect(
      service.getLocalWalletAccountSupport({
        networkId,
        accountId: savedAccountId,
      }),
    ).resolves.toBe('unsupported');
  });

  it('reports an already-enabled temp-wallet account as off', async () => {
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: {
        getAccountState: async () => ({ ...enabledState, birthdayHeight: 1 }),
      },
    });

    await expect(
      service.getLocalWalletAccountState({
        networkId,
        accountId: tempAccountId,
      }),
    ).resolves.toEqual({ enabled: false, paused: false, birthdayHeight: 1 });
    await expect(
      service.getLocalWalletAccountState({
        networkId,
        accountId: savedAccountId,
      }),
    ).resolves.toEqual({ ...enabledState, birthdayHeight: 1 });
  });

  it('keeps the public address but withholds the private one', async () => {
    const { service } = createService({
      tempWalletIds: new Set([tempWalletId]),
      capability: {
        getAccountState: async () => enabledState,
        getAccountAddresses: async () => ({
          publicAddress: 't1-address',
          privateAddress: 'u1-address',
        }),
      },
    });

    await expect(
      service.getLocalWalletAccountAddresses({
        networkId,
        accountId: tempAccountId,
      }),
    ).resolves.toEqual({ publicAddress: 't1-address' });
  });

  it('never derives or stores a viewing key for a temp-wallet account', async () => {
    mockGetViewingKey.mockResolvedValue(undefined);
    const deriveViewingKey = jest.fn(async () => 'view-key');
    mockGetVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ deriveViewingKey }),
    });
    const tempHdAccountId = "hd-2--m/44'/128'/0'";
    const { service } = createService({
      tempWalletIds: new Set(['hd-2']),
      capability: {},
    });

    await expect(
      service.ensureLocalWalletViewingKey({
        networkId: 'xmr--0',
        accountId: tempHdAccountId,
      }),
    ).resolves.toBeUndefined();
    expect(deriveViewingKey).not.toHaveBeenCalled();
    expect(mockSaveViewingKey).not.toHaveBeenCalled();
  });
});

describe('the scheduler never scans temp-wallet accounts', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function createScheduler(tempWalletIds: Set<string>) {
    const syncGroup = jest.fn(async () => ({
      synced: true,
      chainTip: 100,
      backfillRemaining: false,
    }));
    const accounts: ILocalWalletAccount[] = [tempAccountId, savedAccountId].map(
      (accountId) => ({
        accountId,
        runtimeKey: 'main',
        accountRuntimeKey: accountId,
        syncEnabled: true,
      }),
    );
    const doLocalWalletPasswordWork = jest.fn(async () => false);
    const { service } = createService({
      tempWalletIds,
      capability: {
        listAccounts: async () => ({ accounts, cleanupAccountIds: [] }),
        getChainTip: async () => 100,
        syncPolicy: {
          maxSyncDurationMs: 60_000,
          foregroundBackfillDelayMs: 0,
          backgroundBackfillDelayMs: { desktop: 0, default: 0 },
        },
        syncGroup,
        syncCompletionIsAuthoritative: true,
        recoverFromTimeout: async () => false,
      },
      overrides: {
        deviceIsCellular: false,
        syncTickRunning: false,
        syncTickRequested: false,
        quarantinedSyncs: new Map<string, Promise<unknown>>(),
        syncFailureBackoff: new Map(),
        runtimeSyncState: new Map(),
        backfillActiveByAccount: {},
        foregroundBoostRequestedByNetwork: {},
        boostPausedByNetwork: {},
        getLocalWalletNetworkIds: async () => [networkId],
        isPrivacySyncOnCellularAllowed: async () => true,
        isNetworkForegroundHot: () => false,
        scheduleBackgroundSync: jest.fn(),
        publishScanProgress: jest.fn(),
        refreshAutoBoost: jest.fn(),
        doLocalWalletPasswordWork,
      },
    });
    return { service, syncGroup, doLocalWalletPasswordWork };
  }

  it('scans only the saved account of the group', async () => {
    const { service, syncGroup } = createScheduler(new Set([tempWalletId]));

    await service.backgroundSyncTick();

    expect(syncGroup).toHaveBeenCalledTimes(1);
    expect(syncGroup).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: [savedAccountId] }),
    );
  });

  it('does not scan at all when only temp wallets are enabled', async () => {
    const { service, syncGroup } = createScheduler(
      new Set([tempWalletId, savedWalletId]),
    );

    await service.backgroundSyncTick();

    expect(syncGroup).not.toHaveBeenCalled();
  });

  it('picks the account up again once its wallet is kept', async () => {
    const tempWalletIds = new Set([tempWalletId]);
    const { service, syncGroup } = createScheduler(tempWalletIds);
    await service.backgroundSyncTick();

    tempWalletIds.delete(tempWalletId);
    await service.backgroundSyncTick();

    expect(syncGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accountIds: [tempAccountId, savedAccountId].toSorted(),
      }),
    );
  });

  it('does no password work for temp-wallet accounts', async () => {
    const { service, doLocalWalletPasswordWork } = createScheduler(
      new Set([tempWalletId]),
    );

    await service.runLocalWalletPasswordWork();

    expect(doLocalWalletPasswordWork).toHaveBeenCalledWith({
      networkId,
      accountIds: [savedAccountId],
    });
  });
});
