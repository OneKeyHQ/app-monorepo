import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ILocalWalletCapability } from '../vaults/localWallet/types';

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

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type ISyncResult = Awaited<ReturnType<ILocalWalletCapability['syncGroup']>>;

describe('Privacy sync timeout recovery', () => {
  const networkId = 'zec--0';
  const stateKey = `${networkId}|main`;
  const result: ISyncResult = {
    synced: true,
    chainTip: 100,
    backfillRemaining: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createService(
    authoritative: boolean,
    terminated = false,
    isUserOperationActive?: () => boolean,
  ) {
    let resolveSync!: (value: ISyncResult) => void;
    let rejectSync!: (error: Error) => void;
    const pending = new Promise<ISyncResult>((resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    });
    const syncGroup = jest
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(result);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [
            { accountId: 'account', runtimeKey: 'main', syncEnabled: true },
          ],
        }),
        getChainTip: async () => 100,
        syncPolicy: { maxSyncDurationMs: 10 },
        syncGroup,
        syncCompletionIsAuthoritative: authoritative,
        recoverFromTimeout: async () => terminated,
        isUserOperationActive,
      }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        backgroundSyncTick: () => Promise<void>;
      },
      {
        backgroundApi: {
          serviceAccount: {
            getDBAccountSafe: async () => ({ id: 'account' }),
            getWalletSafe: async () => ({ isTemp: false }),
          },
        },
        deviceIsCellular: false,
        syncTickRunning: false,
        syncTickRequested: false,
        quarantinedSyncs: new Map<string, Promise<unknown>>(),
        storageUnsupportedNetworkIds: new Set<string>(),
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
      },
    );
    return { service, syncGroup, resolveSync, rejectSync };
  }

  it.each(['success', 'failure'] as const)(
    'resumes after an authoritative writer finishes with %s',
    async (outcome) => {
      const { service, syncGroup, resolveSync, rejectSync } =
        createService(true);
      const tick = service.backgroundSyncTick();
      await jest.advanceTimersByTimeAsync(11);
      await tick;
      expect(service.quarantinedSyncs.has(stateKey)).toBe(true);

      if (outcome === 'success') resolveSync(result);
      else rejectSync(new Error('writer stopped'));
      await jest.advanceTimersByTimeAsync(0);

      expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
      expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);
      await service.backgroundSyncTick();
      expect(syncGroup).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps a proxy timeout quarantined without proof that its remote writer stopped', async () => {
    const { service, syncGroup, rejectSync } = createService(false);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    rejectSync(new Error('WebEmbed bridge call timeout'));
    await jest.advanceTimersByTimeAsync(0);

    await service.backgroundSyncTick();
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);
    expect(syncGroup).toHaveBeenCalledTimes(1);
  });

  it('clears proxy quarantine when replacement of the carrier is confirmed', async () => {
    const { service } = createService(false, true);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);
  });

  // A sync queued behind a send is not stuck; recovering would kill the send.
  it('does not time out while a user send holds the runtime', async () => {
    let sending = true;
    const { service } = createService(false, true, () => sending);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(50);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
    expect(service.scheduleBackgroundSync).not.toHaveBeenCalled();

    sending = false;
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);
  });

  it('does not clear a newer quarantine when an older writer finishes', async () => {
    const { service, resolveSync } = createService(true);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    const newerWriter = Promise.resolve(result);
    service.quarantinedSyncs.set(stateKey, newerWriter);
    resolveSync(result);
    await jest.advanceTimersByTimeAsync(0);
    expect(service.quarantinedSyncs.get(stateKey)).toBe(newerWriter);
  });
});

describe('Privacy sync failure backoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // A failed turn never records the chain tip, so without backoff the failing
  // group stays `tip` and outranks the other chain's backfill every tick.
  function createTwoChainScheduler(zcashSync: jest.Mock, xmrSync: jest.Mock) {
    const capability = (networkId: string) => ({
      listAccounts: async () => ({
        accounts: [
          {
            accountId: `${networkId}-account`,
            runtimeKey: 'main',
            syncEnabled: true,
          },
        ],
      }),
      getChainTip: async () => 200,
      syncPolicy: { maxSyncDurationMs: 60_000 },
      syncGroup: networkId === 'zec--0' ? zcashSync : xmrSync,
      syncCompletionIsAuthoritative: true,
      recoverFromTimeout: async () => false,
    });
    mockGetChainOnlyVault.mockImplementation(
      async ({ networkId }: { networkId: string }) => ({
        getLocalWalletCapability: () => capability(networkId),
      }),
    );
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        backgroundSyncTick: () => Promise<void>;
      },
      {
        backgroundApi: {
          serviceAccount: {
            getDBAccountSafe: async () => ({ id: 'account' }),
            getWalletSafe: async () => ({ isTemp: false }),
          },
        },
        deviceIsCellular: false,
        syncTickRunning: false,
        syncTickRequested: false,
        quarantinedSyncs: new Map<string, Promise<unknown>>(),
        storageUnsupportedNetworkIds: new Set<string>(),
        syncFailureBackoff: new Map(),
        // Zcash saw tip 100 last time (-> `tip`); XMR is at 200 with history
        // left (-> `backfill`).
        runtimeSyncState: new Map([
          [
            'zec--0|main',
            { accountSignature: 'zec--0-account', lastChainTip: 100 },
          ],
          [
            'xmr--0|main',
            { accountSignature: 'xmr--0-account', lastChainTip: 200 },
          ],
        ]),
        backfillActiveByAccount: { 'xmr--0-account': true },
        foregroundBoostRequestedByNetwork: {},
        boostPausedByNetwork: {},
        getLocalWalletNetworkIds: async () => ['zec--0', 'xmr--0'],
        isPrivacySyncOnCellularAllowed: async () => true,
        isNetworkForegroundHot: () => false,
        scheduleBackgroundSync: jest.fn(),
        publishScanProgress: jest.fn(),
        refreshAutoBoost: jest.fn(),
      },
    );
    return service;
  }

  it('lets another chain backfill while a failing chain backs off', async () => {
    const zcashSync = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));
    const xmrSync = jest.fn().mockResolvedValue({
      synced: true,
      chainTip: 200,
      backfillRemaining: true,
    });
    const service = createTwoChainScheduler(zcashSync, xmrSync);

    await service.backgroundSyncTick();
    expect(zcashSync).toHaveBeenCalledTimes(1);
    expect(xmrSync).not.toHaveBeenCalled();

    await service.backgroundSyncTick();
    expect(zcashSync).toHaveBeenCalledTimes(1);
    expect(xmrSync).toHaveBeenCalledTimes(1);
  });

  // An outdated WebView cannot become usable mid-session; retrying it only
  // takes turns from the chain that works.
  it('never retries a chain whose storage is unsupported', async () => {
    const zcashSync = jest.fn().mockRejectedValue(
      Object.assign(new Error('storage unsupported'), {
        code: 'STORAGE_UNSUPPORTED',
      }),
    );
    const xmrSync = jest.fn().mockResolvedValue({
      synced: true,
      chainTip: 200,
      backfillRemaining: true,
    });
    const service = createTwoChainScheduler(zcashSync, xmrSync);

    await service.backgroundSyncTick();
    expect(zcashSync).toHaveBeenCalledTimes(1);
    // Even once its backoff has run out.
    (
      service as unknown as { syncFailureBackoff: Map<string, unknown> }
    ).syncFailureBackoff.clear();
    await service.backgroundSyncTick();
    await service.backgroundSyncTick();
    expect(zcashSync).toHaveBeenCalledTimes(1);
    expect(xmrSync).toHaveBeenCalled();
  });
});

describe('Privacy password work after a sync turn', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function createService(hasCachedPassword: boolean, alwaysReenter = false) {
    const promptPasswordVerifyByAccount = jest.fn(async () => ({
      password: 'pw',
    }));
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        doLocalWalletPasswordWork: (candidate: {
          networkId: string;
          accountIds: string[];
        }) => Promise<boolean>;
      },
      {
        backgroundApi: {
          servicePassword: {
            hasCachedPassword: async () => hasCachedPassword,
            getCachedPassword: async () =>
              hasCachedPassword ? 'pw' : undefined,
            isAlwaysReenterPassword: async () => alwaysReenter,
            promptPasswordVerifyByAccount,
          },
        },
      },
    );
    return { service, promptPasswordVerifyByAccount };
  }

  // A locked app must never be prompted from a background scan.
  it('does nothing while the app is locked', async () => {
    const { service, promptPasswordVerifyByAccount } = createService(false);
    await expect(
      service.doLocalWalletPasswordWork({
        networkId: 'xmr--0',
        accountIds: ['a'],
      }),
    ).resolves.toBe(false);
    expect(mockGetVault).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });

  it('uses the unlocked session only for accounts that have work', async () => {
    const doWork = jest.fn(async () => true);
    mockGetVault.mockImplementation(
      async ({ accountId }: { accountId: string }) => ({
        localWalletHasPasswordWork: async () => accountId === 'needs',
        localWalletDoPasswordWork: doWork,
      }),
    );
    const { service, promptPasswordVerifyByAccount } = createService(true);
    await expect(
      service.doLocalWalletPasswordWork({
        networkId: 'xmr--0',
        accountIds: ['idle', 'needs'],
      }),
    ).resolves.toBe(true);
    // A scheduler turn never opens a password dialog.
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(doWork).toHaveBeenCalledTimes(1);
    expect(doWork).toHaveBeenCalledWith({ password: 'pw' });
  });

  it('skips when every transaction must re-enter the password', async () => {
    const doWork = jest.fn(async () => true);
    mockGetVault.mockResolvedValue({
      localWalletHasPasswordWork: async () => true,
      localWalletDoPasswordWork: doWork,
    });
    const { service, promptPasswordVerifyByAccount } = createService(
      true,
      true,
    );
    await service.doLocalWalletPasswordWork({
      networkId: 'xmr--0',
      accountIds: ['needs'],
    });
    expect(doWork).not.toHaveBeenCalled();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
  });
});

describe('Privacy enable scan visibility', () => {
  it.each([false, true])(
    'publishes an initial scan request without clearing manual pause (%s)',
    async (paused) => {
      const publishBoostingNetworks = jest.fn();
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        {
          backfillActiveByAccount: {},
          syncFailureBackoff: new Map(),
          orphanCleanupGeneration: new Map(),
          boostPausedByNetwork: { 'zec--0': paused },
          foregroundBoostRequestedByNetwork: {},
          init: jest.fn(),
          scheduleBackgroundSync: jest.fn(),
          publishBoostingNetworks,
        },
      );
      await service.onLocalWalletAccountsChanged({
        networkId: 'zec--0',
        accountIds: ['account'],
        backfillActive: true,
      });
      expect(service.foregroundBoostRequestedByNetwork['zec--0']).toBe(
        paused ? undefined : true,
      );
      expect(service.boostPausedByNetwork['zec--0']).toBe(paused);
      expect(publishBoostingNetworks).toHaveBeenCalledTimes(paused ? 0 : 1);
    },
  );
});

// Host records App Reset deletes per network after the runtime drop.
function pendingDropApi(
  pending: string[],
  getPendingLocalDataDrop: () => Promise<string[]> = async () => pending,
) {
  const noop = async () => undefined;
  return {
    simpleDb: {
      privacyChainState: {
        getPendingLocalDataDrop,
        listAccountIds: async () => [],
        clearRuntimeOrphans: noop,
        removeNetworkAccounts: noop,
        removeAccount: noop,
        forgetAccountEpochs: noop,
      },
      privacyChainKeys: { removeKeys: noop, removeNetworkKeys: noop },
      privacyChainJournal: { removeAccounts: noop },
      privacyChainXmrSent: { removeAccounts: noop },
      privacyChainCache: {
        removeLastBalances: noop,
        removeNetworkLastBalances: noop,
        removeChainTips: noop,
      },
    },
  };
}

const noAccounts = async () => ({ accounts: [], cleanupAccountIds: [] });

const lifecycleFields = () => ({
  backfillActiveByAccount: {},
  boostPausedByNetwork: {},
  syncFailureBackoff: new Map(),
  orphanCleanupGeneration: new Map<string, number>(),
  scheduleBackgroundSync: jest.fn(),
});

describe('Privacy database erasure', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Reset deletes what it can: one runtime that fails or never answers must
  // not keep the other chain's data, or block the rest of the reset.
  it('wipes the other chains when one cannot be wiped', async () => {
    jest.useFakeTimers();
    try {
      const failing = jest
        .fn()
        .mockRejectedValue(new Error('privacy database erase failed'));
      const hanging = jest.fn(() => new Promise<void>(() => {}));
      const working = jest.fn().mockResolvedValue(undefined);
      const drops: Record<string, jest.Mock> = {
        'zec--0': failing,
        'xmr--0': hanging,
        'other--0': working,
      };
      mockGetChainOnlyVault.mockImplementation(
        async ({ networkId }: { networkId: string }) => ({
          getLocalWalletCapability: () => ({
            listAccounts: noAccounts,
            dropLocalData: drops[networkId],
          }),
        }),
      );
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        {
          ...lifecycleFields(),
          backgroundApi: pendingDropApi([]),
          getLocalWalletNetworkIds: async () => Object.keys(drops),
        },
      );

      const done = service.dropAllLocalWalletData();
      await jest.advanceTimersByTimeAsync(60_000);
      await expect(done).resolves.toEqual(['zec--0', 'xmr--0']);
      expect(failing).toHaveBeenCalledTimes(1);
      expect(hanging).toHaveBeenCalledTimes(1);
      expect(working).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
      mockGetChainOnlyVault.mockReset();
    }
  });

  // Host records describe the database just dropped; a failed drop keeps them
  // for the retry the pending mark triggers.
  it('deletes host records only for networks whose database went', async () => {
    const backgroundApi = pendingDropApi([]);
    const removeNetworkAccounts = jest.fn(async () => undefined);
    const clearRuntimeOrphans = jest.fn(async () => undefined);
    const removeNetworkKeys = jest.fn(async () => undefined);
    Object.assign(backgroundApi.simpleDb.privacyChainState, {
      removeNetworkAccounts,
      clearRuntimeOrphans,
    });
    Object.assign(backgroundApi.simpleDb.privacyChainKeys, {
      removeNetworkKeys,
    });
    mockGetChainOnlyVault.mockImplementation(
      async ({ networkId }: { networkId: string }) => ({
        getLocalWalletCapability: () => ({
          listAccounts: noAccounts,
          dropLocalData: async () => {
            if (networkId === 'zec--0')
              throw new OneKeyLocalError('erase failed');
          },
        }),
      }),
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        ...lifecycleFields(),
        backgroundApi,
        getLocalWalletNetworkIds: async () => ['zec--0', 'xmr--0'],
      },
    );

    await expect(service.dropAllLocalWalletData()).resolves.toEqual(['zec--0']);
    for (const spy of [
      removeNetworkAccounts,
      clearRuntimeOrphans,
      removeNetworkKeys,
    ]) {
      expect(spy.mock.calls).toEqual([[{ networkId: 'xmr--0' }]]);
    }
    mockGetChainOnlyVault.mockReset();
  });

  // Queued behind a running scan, the delete would time out and leave the
  // database (with its view keys) on disk.
  it('stops a running scan before deleting', async () => {
    const order: string[] = [];
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        ...lifecycleFields(),
        syncTickRunning: true,
        backgroundApi: pendingDropApi([]),
        getLocalWalletNetworkIds: async () => ['zec--0'],
      },
    );
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: noAccounts,
        recoverFromTimeout: async () => {
          order.push('stop');
          service.syncTickRunning = false;
          return true;
        },
        dropLocalData: async () => {
          order.push('drop');
        },
      }),
    });

    await service.dropAllLocalWalletData();

    expect(order).toEqual(['stop', 'drop']);
    mockGetChainOnlyVault.mockReset();
  });

  // Users who never used a privacy chain must not pay a runtime load on reset.
  it.each([
    { pending: [] as string[], expected: [] as string[] },
    { pending: ['zec--0'], expected: ['zec--0'] },
  ])(
    'wipes only networks that may hold data (pending $pending)',
    async ({ pending, expected }) => {
      const dropped: string[] = [];
      mockGetChainOnlyVault.mockImplementation(
        async ({ networkId }: { networkId: string }) => ({
          getLocalWalletCapability: () => ({
            listAccounts: noAccounts,
            hasLocalData: async () => false,
            dropLocalData: async () => {
              dropped.push(networkId);
            },
          }),
        }),
      );
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        {
          ...lifecycleFields(),
          backgroundApi: pendingDropApi(pending),
          getLocalWalletNetworkIds: async () => ['zec--0', 'xmr--0'],
        },
      );

      await expect(service.dropAllLocalWalletData()).resolves.toEqual([]);
      expect(dropped).toEqual(expected);
      mockGetChainOnlyVault.mockReset();
    },
  );

  // Unreadable storage is when users reset; it must not abort the wipe.
  it('wipes every network when the pending list cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const dropped: string[] = [];
    mockGetChainOnlyVault.mockImplementation(
      async ({ networkId }: { networkId: string }) => ({
        getLocalWalletCapability: () => ({
          listAccounts: noAccounts,
          hasLocalData: async () => false,
          dropLocalData: async () => {
            dropped.push(networkId);
          },
        }),
      }),
    );
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        ...lifecycleFields(),
        backgroundApi: pendingDropApi([], async () => {
          throw new OneKeyLocalError('storage unreadable');
        }),
        getLocalWalletNetworkIds: async () => ['zec--0', 'xmr--0'],
      },
    );

    await expect(service.dropAllLocalWalletData()).resolves.toEqual([]);
    expect(dropped).toEqual(['zec--0', 'xmr--0']);
    mockGetChainOnlyVault.mockReset();
  });

  it('falls back to preset privacy networks when the network list fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const dropped: string[] = [];
    mockGetChainOnlyVault.mockImplementation(
      async ({ networkId }: { networkId: string }) => ({
        getLocalWalletCapability: () => ({
          listAccounts: noAccounts,
          dropLocalData: async () => {
            dropped.push(networkId);
          },
        }),
      }),
    );
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        ...lifecycleFields(),
        backgroundApi: pendingDropApi([]),
        getLocalWalletNetworkIds: async () => {
          throw new OneKeyLocalError('network list unreadable');
        },
      },
    );

    await expect(service.dropAllLocalWalletData()).resolves.toEqual([]);
    expect(dropped).toEqual(expect.arrayContaining(['zec--0', 'xmr--0']));
    mockGetChainOnlyVault.mockReset();
  });
});

describe('Privacy sync backoff after a user action', () => {
  it('drops the failing network backoff when its node changes', async () => {
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        onLocalWalletNodeChanged: (params: {
          networkIds: string[];
        }) => Promise<void>;
        syncFailureBackoff: Map<string, { failures: number; untilMs: number }>;
        scheduleBackgroundSync: jest.Mock;
      },
      {
        syncFailureBackoff: new Map([
          ['zec--0|main', { failures: 3, untilMs: Number.MAX_SAFE_INTEGER }],
          ['xmr--0|main', { failures: 1, untilMs: Number.MAX_SAFE_INTEGER }],
        ]),
        getLocalWalletNetworkIds: async () => ['zec--0', 'xmr--0'],
        scheduleBackgroundSync: jest.fn(),
      },
    );

    await service.onLocalWalletNodeChanged({
      networkIds: ['zec--0', 'evm--1'],
    });

    expect([...service.syncFailureBackoff.keys()]).toEqual(['xmr--0|main']);
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);
  });

  // Custom RPC saves only announce the change; a failure here must not reach them.
  it('handles node changes from the custom RPC event without throwing', async () => {
    const { appEventBus, EAppEventBusNames } = jest.requireActual<
      typeof import('@onekeyhq/shared/src/eventBus/appEventBus')
    >('@onekeyhq/shared/src/eventBus/appEventBus');
    const handled = jest
      .spyOn(ServicePrivacyChain.prototype, 'onLocalWalletNodeChanged')
      .mockRejectedValue(new Error('vault settings unavailable'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    // eslint-disable-next-line no-new
    new ServicePrivacyChain({ backgroundApi: {} as never });

    expect(() =>
      appEventBus.emit(EAppEventBusNames.CustomRpcChanged, {
        networkIds: ['evm--1'],
      }),
    ).not.toThrow();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(handled).toHaveBeenCalledWith({ networkIds: ['evm--1'] });
    expect(logged).toHaveBeenCalled();
    handled.mockRestore();
    logged.mockRestore();
  });
});
