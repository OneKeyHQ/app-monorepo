jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

type IPublished = {
  progress: Record<string, unknown>;
  boostingNetworkIds: string[];
  dataBlockedNetworkIds: string[];
  pausedNetworkIds: string[];
  preparingAccountKeys: string[];
  syncErrorByNetworkId: Record<string, string>;
  allowCellularSync?: boolean;
};

const mockEmptyState = (): IPublished => ({
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
  preparingAccountKeys: [],
  syncErrorByNetworkId: {},
});

let mockPublished: IPublished = mockEmptyState();

jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: {
    set: jest.fn(async (updater: (value: IPublished) => IPublished) => {
      mockPublished = updater(mockPublished);
    }),
    get: jest.fn(async () => mockPublished),
  },
}));

const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));

const { PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT } = jest.requireActual<
  typeof import('@onekeyhq/shared/src/utils/privacyChainSyncPolicy')
>('@onekeyhq/shared/src/utils/privacyChainSyncPolicy');

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('Privacy sync light pause state', () => {
  const networkId = 'zec--0';

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  function createService({ cellularBlocked = false } = {}) {
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        publishBoostingNetworks: () => Promise<void>;
        pauseLocalWalletScan: (params: { networkId: string }) => Promise<void>;
        refreshAutoBoost: (candidate: unknown) => Promise<void>;
        onLocalWalletAccountsChanged: (params: {
          networkId: string;
          accountIds: string[];
          backfillActive: boolean;
        }) => Promise<void>;
        markLocalWalletOrphanCleanupDue: (networkId: string) => void;
        startForegroundBoost: (params: {
          networkId: string;
          accountId?: string;
          trigger: 'manual-sync';
        }) => Promise<void>;
        repairLocalChainData: (params: {
          networkId: string;
          accountId: string;
          mode: 'height';
          birthdayHeight: number;
        }) => Promise<void>;
        foregroundBoostRequestedByNetwork: Record<string, boolean>;
        boostPausedByNetwork: Record<string, boolean>;
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: cellularBlocked,
        allowPrivacySyncOnCellularCache: !cellularBlocked,
        orphanCleanupGeneration: new Map<string, number>(),
        syncFailureBackoff: new Map(),
        backfillActiveByAccount: {},
        init: jest.fn(async (): Promise<void> => undefined),
        scheduleBackgroundSync: jest.fn(),
        backgroundApi: {
          serviceAccount: {
            getWalletSafe: async () => ({ isTemp: false }),
          },
          simpleDb: {
            privacyChainState: {
              saveScanPaused: jest.fn(async () => undefined),
            },
          },
        },
      },
    );
  }

  function capabilityForAccounts(accountIds: string[]) {
    return {
      listAccounts: async () => ({
        accounts: accountIds.map((accountId) => ({
          accountId,
          runtimeKey: 'main',
          accountRuntimeKey: accountId,
          syncEnabled: true,
        })),
        cleanupAccountIds: [],
      }),
    };
  }

  it('keeps the paused network published so the light stays on screen', async () => {
    const service = createService();
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
    expect(mockPublished.pausedNetworkIds).toEqual([]);

    await service.pauseLocalWalletScan({ networkId });

    expect(mockPublished.boostingNetworkIds).toEqual([]);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
  });

  it('does not ask a paused network for metered-data consent', async () => {
    const service = createService({ cellularBlocked: true });
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    expect(mockPublished.dataBlockedNetworkIds).toEqual([networkId]);

    await service.pauseLocalWalletScan({ networkId });

    expect(mockPublished.dataBlockedNetworkIds).toEqual([]);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
  });

  it('survives the next scheduler pass, which wants no boost while paused', async () => {
    const service = createService();
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.pauseLocalWalletScan({ networkId });

    await service.refreshAutoBoost({
      networkId,
      accountIds: ['account'],
      capability: capabilityForAccounts(['account']),
    });

    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
  });

  describe('shows the light only for a long wait', () => {
    const publishBehind = (
      accountId: string,
      { backfill, tipLag }: { backfill: number; tipLag: number },
    ) => {
      mockPublished.progress[`${networkId}:${accountId}`] = {
        backfillScannedHeight: 100_000 - backfill,
        backfillTargetHeight: 100_000,
        isBackfillComplete: backfill === 0,
        tipLag,
      };
    };
    const pass = (
      service: ReturnType<typeof createService>,
      accountIds = ['account'],
    ) =>
      service.refreshAutoBoost({
        networkId,
        accountIds,
        capability: capabilityForAccounts(accountIds),
      });

    // Zcash counts as synced below 48 blocks left (`syncedBelowBlocks`).
    it('turns on at the threshold and stays on until the chain counts as synced', async () => {
      const service = createService();
      publishBehind('account', {
        backfill: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT - 1,
        tipLag: 0,
      });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([]);

      publishBehind('account', {
        backfill: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
        tipLag: 0,
      });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([networkId]);

      publishBehind('account', { backfill: 0, tipLag: 48 });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([networkId]);

      publishBehind('account', { backfill: 0, tipLag: 47 });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([]);
    });

    it('counts how far the scan trails the tip', async () => {
      const service = createService();
      publishBehind('account', {
        backfill: 0,
        tipLag: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
      });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
    });

    it('lets the account furthest behind decide', async () => {
      const service = createService();
      publishBehind('synced', { backfill: 0, tipLag: 1 });
      publishBehind('behind', {
        backfill: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
        tipLag: 0,
      });
      await pass(service, ['synced', 'behind']);
      expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
    });

    it('stays off before any pass has published a position', async () => {
      const service = createService();
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([]);
    });
  });

  describe('a rescan from a new start', () => {
    const repair = {
      networkId,
      accountId: 'account',
      mode: 'height' as const,
      birthdayHeight: 3_000_000,
    };
    const createRepairService = ({
      enabled = true,
      runLocalChainDataRepair = jest.fn(async () => undefined),
    } = {}) => {
      const startUserSync = jest.fn(async () => undefined);
      const service = Object.assign(createService(), {
        repairMutexByAccount: new Map(),
        runLocalChainDataRepair,
        requireAccountCapability: async () => ({
          getAccountState: async () => ({ enabled, paused: !enabled }),
        }),
        startUserSync,
      });
      return { service, startUserSync };
    };

    it('shows at once instead of after the first pass', async () => {
      let preparingWhileRunning: string[] = [];
      const { service, startUserSync } = createRepairService({
        runLocalChainDataRepair: jest.fn(async () => {
          preparingWhileRunning = [...mockPublished.preparingAccountKeys];
          return undefined;
        }),
      });
      await service.repairLocalChainData(repair);
      // Preparing from the press, not once the rescan is done.
      expect(preparingWhileRunning).toEqual([`${networkId}:account`]);
      expect(startUserSync).toHaveBeenCalledWith({
        networkId,
        accountId: 'account',
      });
    });

    it('leaves a paused account waiting for resume', async () => {
      const { service, startUserSync } = createRepairService({
        enabled: false,
      });
      await service.repairLocalChainData(repair);
      expect(startUserSync).not.toHaveBeenCalled();
    });

    it('keeps a paused chain paused, with its new start saved', async () => {
      const { service, startUserSync } = createRepairService();
      service.boostPausedByNetwork[networkId] = true;
      await service.repairLocalChainData(repair);
      expect(startUserSync).not.toHaveBeenCalled();
    });

    it('shows nothing when the rescan fails', async () => {
      const { service, startUserSync } = createRepairService({
        runLocalChainDataRepair: jest
          .fn()
          .mockRejectedValue(new Error('rescan failed')),
      });
      await expect(service.repairLocalChainData(repair)).rejects.toThrow();
      expect(startUserSync).not.toHaveBeenCalled();
      expect(mockPublished.preparingAccountKeys).toEqual([]);
    });
  });

  // Pause then Sync within one block: without a pass, nothing clears Preparing.
  it('runs a pass on a manual sync even at an unchanged tip', async () => {
    const service = Object.assign(createService(), {
      runtimeSyncState: new Map([
        [`${networkId}|main`, { accountSignature: 'account', lastChainTip: 1 }],
      ]),
      getLocalWalletNetworkIds: async () => [networkId],
    });
    await service.pauseLocalWalletScan({ networkId });
    await service.startForegroundBoost({
      networkId,
      accountId: 'account',
      trigger: 'manual-sync',
    });
    expect(service.runtimeSyncState.size).toBe(0);
    expect(mockPublished.preparingAccountKeys).toEqual([
      `${networkId}:account`,
    ]);
  });

  // No pass runs on metered data without consent, so Preparing would never clear.
  it('shows no Preparing for a manual sync held by metered data', async () => {
    const service = Object.assign(createService({ cellularBlocked: true }), {
      runtimeSyncState: new Map(),
      getLocalWalletNetworkIds: async () => [networkId],
    });
    Object.assign(service.backgroundApi.simpleDb.privacyChainState, {
      getAllowCellularSync: async () => false,
    });
    await service.startForegroundBoost({
      networkId,
      accountId: 'account',
      trigger: 'manual-sync',
    });
    expect(mockPublished.preparingAccountKeys).toEqual([]);
    expect(mockPublished.dataBlockedNetworkIds).toEqual([networkId]);
  });

  // Pausing from Settings or after the boost request cleared must still publish, or the light stays
  // hidden.
  it('publishes a pause even when no boost was ever requested', async () => {
    const service = createService();
    await service.pauseLocalWalletScan({ networkId });
    expect(
      service.foregroundBoostRequestedByNetwork[networkId],
    ).toBeUndefined();
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
    expect(mockPublished.boostingNetworkIds).toEqual([]);
    expect(mockPublished.dataBlockedNetworkIds).toEqual([]);
  });

  it('removes a paused control when its last enabled account is gone', async () => {
    const service = createService();
    await service.pauseLocalWalletScan({ networkId });
    await service.refreshAutoBoost({
      networkId,
      accountIds: ['deleted'],
      capability: capabilityForAccounts([]),
    });
    expect(service.boostPausedByNetwork[networkId]).toBeUndefined();
    expect(mockPublished.pausedNetworkIds).toEqual([]);
    expect(mockPublished.boostingNetworkIds).toEqual([]);
  });

  it('hides the last deleted account before deferred runtime preparation', async () => {
    const service = createService();
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => capabilityForAccounts([]),
    });
    await service.onLocalWalletAccountsChanged({
      networkId,
      accountIds: ['deleted'],
      backfillActive: false,
    });
    expect(
      service.foregroundBoostRequestedByNetwork[networkId],
    ).toBeUndefined();
    expect(mockPublished.boostingNetworkIds).toEqual([]);
  });

  it('preserves an explicit request while a live new account has no progress', async () => {
    const service = createService();
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    await service.refreshAutoBoost({
      networkId,
      accountIds: ['new'],
      capability: capabilityForAccounts(['new']),
    });
    expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
  });

  it('uses another currently enabled account instead of a stale completed group', async () => {
    const service = createService();
    mockPublished.progress[`${networkId}:old`] = {
      isBackfillComplete: true,
      tipLag: 0,
    };
    mockPublished.progress[`${networkId}:behind`] = {
      isBackfillComplete: false,
      backfillScannedHeight: 0,
      backfillTargetHeight: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT,
      tipLag: 0,
    };
    await service.refreshAutoBoost({
      networkId,
      accountIds: ['old'],
      capability: capabilityForAccounts(['behind']),
    });
    expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
  });

  it('does not clear a re-enable that races an older account enumeration', async () => {
    const service = createService();
    let finishList!: (value: { accounts: []; cleanupAccountIds: [] }) => void;
    const listing = new Promise<{ accounts: []; cleanupAccountIds: [] }>(
      (resolve) => {
        finishList = resolve;
      },
    );
    const refresh = service.refreshAutoBoost({
      networkId,
      accountIds: [],
      capability: { listAccounts: () => listing },
    });
    service.markLocalWalletOrphanCleanupDue(networkId);
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    finishList({ accounts: [], cleanupAccountIds: [] });
    await refresh;
    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
    expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
  });

  it('does not recreate a deleted control when an earlier enable finishes init', async () => {
    const service = createService();
    let finishInit!: () => void;
    let initRequested!: () => void;
    const requested = new Promise<void>((resolve) => {
      initRequested = resolve;
    });
    service.init.mockImplementationOnce(() => {
      initRequested();
      return new Promise<void>((resolve) => {
        finishInit = resolve;
      });
    });
    const enabling = service.onLocalWalletAccountsChanged({
      networkId,
      accountIds: ['deleted'],
      backfillActive: true,
    });
    await requested;
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => capabilityForAccounts([]),
    });
    await service.onLocalWalletAccountsChanged({
      networkId,
      accountIds: ['deleted'],
      backfillActive: false,
    });
    finishInit();
    await enabling;
    expect(mockPublished.boostingNetworkIds).toEqual([]);
    expect(
      service.foregroundBoostRequestedByNetwork[networkId],
    ).toBeUndefined();
  });
  it('keeps a new account visible when another account is deleted', async () => {
    const service = createService();
    // As the user's enable would.
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    await service.publishBoostingNetworks();
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => capabilityForAccounts(['new']),
    });
    await service.onLocalWalletAccountsChanged({
      networkId,
      accountIds: ['old'],
      backfillActive: false,
    });
    expect(mockPublished.boostingNetworkIds).toEqual([networkId]);
  });
});

describe('Privacy data consent publish', () => {
  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  // The settings switch reads it from here, so a Use mobile data pressed elsewhere shows at once.
  it('publishes the stored consent once read, and a change at once', async () => {
    let stored = true;
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        isPrivacySyncOnCellularAllowed: () => Promise<boolean>;
        setAllowCellularSync: (params: { allow: boolean }) => Promise<void>;
      },
      {
        allowCellularSyncCache: false,
        boostPausedByNetwork: {} as Record<string, boolean>,
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: false,
        scheduleBackgroundSync: jest.fn(),
        backgroundApi: {
          simpleDb: {
            privacyChainState: {
              getAllowCellularSync: async () => stored,
              setAllowCellularSync: async ({ allow }: { allow: boolean }) => {
                stored = allow;
              },
            },
          },
        },
      },
    );
    expect(mockPublished.allowCellularSync).toBeUndefined();
    await service.isPrivacySyncOnCellularAllowed();
    expect(mockPublished.allowCellularSync).toBe(true);
    await service.setAllowCellularSync({ allow: false });
    expect(mockPublished.allowCellularSync).toBe(false);
  });
});

describe('Privacy connection failures after a network change', () => {
  const networkId = 'zec--0';
  const runtimeStateKey = `${networkId}|main`;

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  function createFailedService({
    deviceIsCellular,
  }: {
    deviceIsCellular: boolean | undefined;
  }) {
    mockPublished.syncErrorByNetworkId = { [networkId]: 'nodeUnreachable' };
    const scheduleBackgroundSync = jest.fn();
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        setAllowCellularSync: (params: { allow: boolean }) => Promise<void>;
        setDeviceNetworkState: (params: {
          isCellular: boolean | undefined;
        }) => Promise<void>;
        syncFailureBackoff: Map<string, unknown>;
      },
      {
        allowCellularSyncCache: false,
        boostPausedByNetwork: {} as Record<string, boolean>,
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular,
        syncFailureBackoff: new Map([
          [runtimeStateKey, { failures: 4, untilMs: Date.now() + 60_000 }],
        ]),
        scheduleBackgroundSync,
        getLocalWalletNetworkIds: async () => [networkId],
        backgroundApi: {
          simpleDb: {
            privacyChainState: {
              setAllowCellularSync: async () => undefined,
            },
          },
        },
      },
    );
    return { service, scheduleBackgroundSync };
  }

  // A failure from before the user chose mobile data must not hold the retry it asked for.
  it('retries at once when mobile data is allowed', async () => {
    const { service, scheduleBackgroundSync } = createFailedService({
      deviceIsCellular: true,
    });
    await service.setAllowCellularSync({ allow: true });
    expect(service.syncFailureBackoff.has(runtimeStateKey)).toBe(false);
    expect(mockPublished.syncErrorByNetworkId).toEqual({});
    expect(scheduleBackgroundSync).toHaveBeenCalledWith(0);
  });

  it.each([
    [false, true],
    [true, false],
  ])('retries at once on a switch from cellular %s to %s', async (from, to) => {
    const { service, scheduleBackgroundSync } = createFailedService({
      deviceIsCellular: from,
    });
    await service.setDeviceNetworkState({ isCellular: to });
    expect(service.syncFailureBackoff.has(runtimeStateKey)).toBe(false);
    expect(mockPublished.syncErrorByNetworkId).toEqual({});
    expect(scheduleBackgroundSync).toHaveBeenCalledWith(0);
  });

  it.each([
    ['the same network reported again', true, true],
    ['losing the network', true, undefined],
  ])('keeps the failure for %s', async (_case, from, to) => {
    const { service, scheduleBackgroundSync } = createFailedService({
      deviceIsCellular: from,
    });
    await service.setDeviceNetworkState({ isCellular: to });
    expect(service.syncFailureBackoff.has(runtimeStateKey)).toBe(true);
    expect(mockPublished.syncErrorByNetworkId).toEqual({
      [networkId]: 'nodeUnreachable',
    });
    expect(scheduleBackgroundSync).not.toHaveBeenCalled();
  });
});

describe('Privacy progress forgotten for a rescan', () => {
  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  // A new start makes blocks done jump; measured as speed it would promise minutes for hours.
  it('starts the speed over with the position', async () => {
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        forgetPublishedProgress: (params: {
          networkId: string;
          accountIds: string[];
        }) => Promise<void>;
        scanRateSamples: Map<string, unknown>;
      },
      {
        scanRateSamples: new Map([
          ['zec--0:a', { done: 1 }],
          ['zec--0:b', { done: 1 }],
        ]),
      },
    );
    mockPublished.progress['zec--0:a'] = { tipScannedHeight: 1 };
    await service.forgetPublishedProgress({
      networkId: 'zec--0',
      accountIds: ['a'],
    });
    expect([...service.scanRateSamples.keys()]).toEqual(['zec--0:b']);
    expect(mockPublished.progress['zec--0:a']).toBeUndefined();
  });
});

describe('Privacy scan held between steps', () => {
  // Read between every scan step, so it must not touch storage.
  it('answers from memory: a chain pause or a lost data consent', async () => {
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        isLocalWalletScanHeld: (networkId: string) => Promise<boolean>;
      },
      {
        boostPausedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: false,
        allowCellularSyncCache: false,
      },
    );
    await expect(service.isLocalWalletScanHeld('zec--0')).resolves.toBe(false);
    Object.assign(service, { deviceIsCellular: true });
    await expect(service.isLocalWalletScanHeld('zec--0')).resolves.toBe(true);
    Object.assign(service, {
      deviceIsCellular: false,
      boostPausedByNetwork: { 'zec--0': true },
    });
    await expect(service.isLocalWalletScanHeld('zec--0')).resolves.toBe(true);
  });
});

describe('Privacy chain pause survives a restart', () => {
  const networkId = 'zec--0';

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  // Stands in for the saved chain switch, shared across "launches".
  function createStore() {
    let saved: string[] = [];
    return {
      getPausedNetworkIds: jest.fn(async () => saved),
      setNetworkPaused: jest.fn(
        async (params: { networkId: string; paused: boolean }) => {
          saved = saved.filter((id) => id !== params.networkId);
          if (params.paused) saved = [...saved, params.networkId];
        },
      ),
    };
  }

  function createService(store: ReturnType<typeof createStore>) {
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        pauseLocalWalletScan: (params: { networkId: string }) => Promise<void>;
        loadChainPauses: () => Promise<void>;
        setChainPaused: (networkId: string, paused: boolean) => Promise<void>;
        boostPausedByNetwork: Record<string, boolean>;
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: false,
        allowCellularSyncCache: true,
        backgroundApi: { simpleDb: { privacyChainState: store } },
      },
    );
  }

  it('saves the chain pause', async () => {
    const store = createStore();
    const service = createService(store);

    await service.pauseLocalWalletScan({ networkId });

    expect(service.boostPausedByNetwork[networkId]).toBe(true);
    expect(store.setNetworkPaused).toHaveBeenCalledWith({
      networkId,
      paused: true,
    });
  });

  it('starts the next session still paused, until a Sync lifts it', async () => {
    const store = createStore();
    await createService(store).pauseLocalWalletScan({ networkId });

    const restarted = createService(store);
    await restarted.loadChainPauses();
    expect(restarted.boostPausedByNetwork[networkId]).toBe(true);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);

    await restarted.setChainPaused(networkId, false);
    const next = createService(store);
    await next.loadChainPauses();
    expect(next.boostPausedByNetwork).toEqual({});
  });
});

describe('Privacy per-step progress publish', () => {
  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  it("keeps the other accounts' progress on the same network", async () => {
    mockPublished.progress['xmr--0:other'] = { tipScannedHeight: 5 };
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        getSyncProgress: async () => ({ tipScannedHeight: 9 }),
      }),
    });
    const service = Object.create(ServicePrivacyChain.prototype) as {
      publishLocalWalletSyncProgress: (params: {
        networkId: string;
        accountIds: string[];
      }) => Promise<void>;
    };

    await service.publishLocalWalletSyncProgress({
      networkId: 'xmr--0',
      accountIds: ['scanning'],
    });

    expect(mockPublished.progress).toEqual({
      'xmr--0:other': { tipScannedHeight: 5 },
      'xmr--0:scanning': { tipScannedHeight: 9 },
    });
  });
});

describe('Privacy sync timer', () => {
  it('pulls a pending later timer forward and keeps an earlier one', () => {
    jest.useFakeTimers();
    try {
      const backgroundSyncTick = jest.fn(async () => undefined);
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as {
          scheduleBackgroundSync: (delayMs: number) => void;
        },
        { earliestTickAt: 0, syncTimerDueAt: 0, backgroundSyncTick },
      );
      service.scheduleBackgroundSync(30_000);
      service.scheduleBackgroundSync(0);
      jest.advanceTimersByTime(10);
      expect(backgroundSyncTick).toHaveBeenCalledTimes(1);

      service.scheduleBackgroundSync(5000);
      service.scheduleBackgroundSync(20_000);
      jest.advanceTimersByTime(5000);
      expect(backgroundSyncTick).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Privacy held-on-mobile-data publish', () => {
  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  async function publishWith(progress: Record<string, unknown>) {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [{ accountId: 'a', syncEnabled: true }],
          cleanupAccountIds: [],
        }),
        getSyncProgress: async () => progress,
      }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        publishHeldScanProgress: () => Promise<void>;
        foregroundBoostRequestedByNetwork: Record<string, boolean>;
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        backgroundApi: {
          serviceAccount: { getWalletSafe: async () => ({ isTemp: false }) },
        },
        getLocalWalletNetworkIds: async () => ['xmr--0'],
        publishBoostingNetworks: async () => undefined,
      },
    );
    await service.publishHeldScanProgress();
    return service.foregroundBoostRequestedByNetwork['xmr--0'];
  }

  // A synced chain has nothing to hold; marking it would show "boosting".
  it('does not mark a synced chain as wanting to run', async () => {
    await expect(
      publishWith({ isTipCaughtUp: true, isBackfillComplete: true }),
    ).resolves.toBeUndefined();
  });

  it('marks a chain with work left so the light can offer consent', async () => {
    await expect(
      publishWith({ isTipCaughtUp: false, isBackfillComplete: true }),
    ).resolves.toBe(true);
  });
});
