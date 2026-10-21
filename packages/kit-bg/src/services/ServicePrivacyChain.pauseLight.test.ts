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

type IPublished = {
  progress: Record<string, unknown>;
  boostingNetworkIds: string[];
  dataBlockedNetworkIds: string[];
  pausedNetworkIds: string[];
  syncErrorByNetworkId: Record<string, string>;
};

const mockEmptyState = (): IPublished => ({
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
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
        foregroundBoostRequestedByNetwork: Record<string, boolean>;
        boostPausedByNetwork: Record<string, boolean>;
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: cellularBlocked,
        allowPrivacySyncOnCellularCache: !cellularBlocked,
        backgroundApi: {
          simpleDb: {
            privacyChainState: {
              saveScanPaused: jest.fn(async () => undefined),
            },
          },
        },
      },
    );
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
      capability: { syncPolicy: {} },
    });

    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
  });

  // A floating window over every page: on only for a long wait.
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
        capability: { syncPolicy: {} },
      });

    it('turns on at the threshold and off once below it', async () => {
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

      publishBehind('account', {
        backfill: PRIVACY_CHAIN_LIGHT_MIN_BLOCKS_LEFT - 1,
        tipLag: 0,
      });
      await pass(service);
      expect(mockPublished.boostingNetworkIds).toEqual([]);
    });

    // A finished backfill that fell behind the tip is just as unusable.
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

  // Pausing from Settings, or after the boost request cleared, must still
  // publish: otherwise the chain sits silently paused with the light hidden.
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
});

describe('Privacy scan pause is session-scoped', () => {
  const networkId = 'zec--0';

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  function createService() {
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        pauseLocalWalletScan: (params: { networkId: string }) => Promise<void>;
        boostPausedByNetwork: Record<string, boolean>;
        backgroundApi: {
          simpleDb: { privacyChainState: Record<string, unknown> };
        };
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        deviceIsCellular: false,
        allowCellularSyncCache: true,
        backgroundApi: { simpleDb: { privacyChainState: {} } },
      },
    );
  }

  it('keeps the pause in memory without storing it', async () => {
    const service = createService();

    await service.pauseLocalWalletScan({ networkId });

    expect(service.boostPausedByNetwork[networkId]).toBe(true);
    // Nothing to persist through: "not right now" describes this sitting,
    // not a setting. The empty store proves no write was attempted.
    expect(service.backgroundApi.simpleDb.privacyChainState).toEqual({});
  });

  it('starts the next session scanning again', async () => {
    const first = createService();
    await first.pauseLocalWalletScan({ networkId });

    const restarted = createService();

    expect(restarted.boostPausedByNetwork).toEqual({});
  });
});

// XMR publishes after every step with the one account it is scanning; the
// network's other accounts must keep their rows.
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

// "Sync now" must not wait out an idle timer that was already pending.
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
