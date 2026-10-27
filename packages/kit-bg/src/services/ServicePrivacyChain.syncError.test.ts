import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IPrivacyChainScanState } from '../states/jotai/atoms';

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

const mockEmptyState = (): IPrivacyChainScanState => ({
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
  preparingNetworkIds: [],
  storageUnsupportedNetworkIds: [],
  syncErrorByNetworkId: {},
});
let mockPublished = mockEmptyState();

jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: {
    set: jest.fn(
      async (
        updater: (value: IPrivacyChainScanState) => IPrivacyChainScanState,
      ) => {
        mockPublished = updater(mockPublished);
      },
    ),
    get: jest.fn(async () => mockPublished),
  },
}));

const mockGetChainOnlyVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('Privacy sync failure state', () => {
  const networkId = 'zec--0';

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService({
    syncGroup,
    getChainTip = async () => 100,
    listAccounts = async () => ({
      accounts: [
        { accountId: 'account', runtimeKey: 'main', syncEnabled: true },
      ],
    }),
  }: {
    syncGroup: jest.Mock;
    getChainTip?: () => Promise<number>;
    listAccounts?: () => Promise<{
      accounts: {
        accountId: string;
        runtimeKey: string;
        syncEnabled: boolean;
      }[];
    }>;
  }) {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts,
        getChainTip,
        syncPolicy: { maxSyncDurationMs: 60_000 },
        syncGroup,
        syncCompletionIsAuthoritative: true,
        recoverFromTimeout: async () => false,
      }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        backgroundSyncTick: () => Promise<void>;
        pauseLocalWalletScan: (params: { networkId: string }) => Promise<void>;
        startForegroundBoost: (params: {
          networkId: string;
          trigger: 'manual-sync';
        }) => Promise<void>;
        markLocalWalletOrphanCleanupDue: (id: string) => void;
      },
      {
        backgroundApi: {
          simpleDb: {
            privacyChainState: { getAccountEpoch: async () => undefined },
          },
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
        orphanCleanupGeneration: new Map<string, number>(),
        backfillActiveByAccount: {} as Record<string, boolean>,
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        getLocalWalletNetworkIds: async () => [networkId],
        isPrivacySyncOnCellularAllowed: async () => true,
        isNetworkForegroundHot: () => false,
        scheduleBackgroundSync: jest.fn(),
        publishScanProgress: jest.fn(),
        publishBoostingNetworks: jest.fn(),
        refreshAutoBoost: jest.fn(),
        runLocalWalletOrphanCleanupIfDue: jest.fn(),
        doLocalWalletPasswordWork: jest.fn(async () => false),
        init: jest.fn(),
      },
    );
  }

  it('publishes a dead runtime, then clears it on the next good pass', async () => {
    const syncGroup = jest
      .fn()
      .mockRejectedValueOnce(
        new OneKeyLocalError({
          message: 'zcash worker: handshake timed out',
          data: { privacyChainRuntimeFailure: 'handshake' },
        }),
      )
      .mockResolvedValue({ synced: true, chainTip: 100 });
    const service = createService({ syncGroup });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.backgroundSyncTick();
    expect(mockPublished.syncErrorByNetworkId).toEqual({
      [networkId]: 'runtimeUnavailable',
    });

    (
      service as unknown as { syncFailureBackoff: Map<string, unknown> }
    ).syncFailureBackoff.clear();
    await service.backgroundSyncTick();
    expect(mockPublished.syncErrorByNetworkId).toEqual({});
  });

  it('names an unreachable node when even the chain tip fails', async () => {
    const service = createService({
      syncGroup: jest.fn(),
      getChainTip: async () => {
        throw new OneKeyLocalError(
          JSON.stringify({ code: 'NETWORK_ERROR', params: {} }),
        );
      },
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await service.backgroundSyncTick();

    expect(mockPublished.syncErrorByNetworkId).toEqual({
      [networkId]: 'nodeUnreachable',
    });
  });

  it('drops the failure when the user presses Sync', async () => {
    mockPublished.syncErrorByNetworkId = { [networkId]: 'failed' };
    const service = createService({ syncGroup: jest.fn() });

    await service.startForegroundBoost({ networkId, trigger: 'manual-sync' });

    expect(mockPublished.syncErrorByNetworkId).toEqual({});
  });

  it('prunes a paused network with no remaining account or boost request', async () => {
    const service = createService({
      syncGroup: jest.fn(),
      listAccounts: async () => ({ accounts: [] }),
    });
    service.boostPausedByNetwork[networkId] = true;

    await service.backgroundSyncTick();

    expect(service.boostPausedByNetwork[networkId]).toBeUndefined();
    expect(service.publishBoostingNetworks).toHaveBeenCalledTimes(1);
  });

  it('does not prune a new enable from an older empty enumeration', async () => {
    let resolveList!: (value: { accounts: [] }) => void;
    let requested!: () => void;
    const listing = new Promise<{ accounts: [] }>((resolve) => {
      resolveList = resolve;
    });
    const listRequested = new Promise<void>((resolve) => {
      requested = resolve;
    });
    const service = createService({
      syncGroup: jest.fn(),
      listAccounts: () => {
        requested();
        return listing;
      },
    });
    const tick = service.backgroundSyncTick();
    await listRequested;
    service.markLocalWalletOrphanCleanupDue(networkId);
    service.foregroundBoostRequestedByNetwork[networkId] = true;
    service.backfillActiveByAccount.new = true;
    const newProgress = {
      birthdayHeight: 0,
      backfillScannedHeight: 0,
      backfillTargetHeight: 100,
      backfillProgress: 0,
      isBackfillComplete: false,
      tipScannedHeight: 90,
      chainTip: 100,
      tipLag: 10,
      isTipCaughtUp: false,
      isSyncing: true,
    };
    mockPublished.progress[`${networkId}:new`] = newProgress;
    mockPublished.syncErrorByNetworkId[networkId] = 'nodeUnreachable';
    resolveList({ accounts: [] });
    await tick;

    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
    expect(service.backfillActiveByAccount.new).toBe(true);
    expect(mockPublished.progress[`${networkId}:new`]).toBe(newProgress);
    expect(mockPublished.syncErrorByNetworkId[networkId]).toBe(
      'nodeUnreachable',
    );
  });

  it('honors a pause made while the node tip is loading and resumes only on an explicit request', async () => {
    let resolveTip: (height: number) => void = () => undefined;
    let markTipRequested: () => void = () => undefined;
    const tip = new Promise<number>((resolve) => {
      resolveTip = resolve;
    });
    const tipRequested = new Promise<void>((resolve) => {
      markTipRequested = resolve;
    });
    const syncGroup = jest
      .fn()
      .mockResolvedValue({ synced: true, chainTip: 100 });
    const service = createService({
      syncGroup,
      getChainTip: async () => {
        markTipRequested();
        return tip;
      },
    });

    const tick = service.backgroundSyncTick();
    try {
      await tipRequested;
      await service.pauseLocalWalletScan({ networkId });
    } finally {
      resolveTip(100);
      await tick;
    }
    expect(syncGroup).not.toHaveBeenCalled();

    await service.backgroundSyncTick();
    expect(syncGroup).not.toHaveBeenCalled();
    await service.startForegroundBoost({ networkId, trigger: 'manual-sync' });
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(1);
  });
});
