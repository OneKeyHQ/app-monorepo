import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { setLocalWalletRemoteConfigs } from '../vaults/localWallet/remoteConfig';

import type { IPrivacyChainScanState } from '../states/jotai/atoms';
import type {
  ILocalWalletAccountState,
  ILocalWalletSendReadiness,
  ILocalWalletSyncPolicy,
} from '../vaults/localWallet/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockPrivacyChainLogger = {
  privacyEnabled: jest.fn(),
  privacyEnableFailed: jest.fn(),
  privacyFirstSyncCompleted: jest.fn(),
  privacyFirstSyncFailed: jest.fn(),
};
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { wallet: { privacyChain: mockPrivacyChainLogger } },
}));

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
jest.mock('../vaults/settings', () => ({
  getVaultSettings: jest.fn(async () => ({
    localWallet: {
      pools: [
        { id: 0, key: 'transparent', kind: 'public', source: 'backend' },
        { id: 1, key: 'orchard', kind: 'private', source: 'localScan' },
      ],
    },
  })),
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = {
  backgroundSyncTick: () => Promise<void>;
  requestLocalWalletSendSync: (params: {
    networkId: string;
    accountId: string;
    sourcePool: string | undefined;
  }) => Promise<void>;
  getLocalWalletSendReadiness: (params: {
    networkId: string;
    accountId: string;
    sourcePool?: string;
  }) => Promise<ILocalWalletSendReadiness | undefined>;
  onLocalWalletTransactionBroadcast: (params: {
    networkId: string;
    encodedTx: { zcashMode?: string; zcashTo?: string };
  }) => Promise<void>;
  enableLocalWalletAccount: (params: {
    networkId: string;
    accountId: string;
  }) => Promise<void>;
  runtimeSyncState: Map<string, unknown>;
  boostPausedByNetwork: Record<string, boolean>;
  scheduleBackgroundSync: jest.Mock;
  refreshLocalWalletAccount: jest.Mock;
};

const networkId = 'zec--0';
const accountId = 'hd-1--0';
const stateKey = `${networkId}|main`;
const sendSyncPolicy: ILocalWalletSyncPolicy = {
  maxSyncDurationMs: 60_000,
  foregroundBackfillDelayMs: 500,
  backgroundBackfillDelayMs: { desktop: 5000, default: 30_000 },
  sendSync: { followUpSyncs: 3, followUpIntervalMs: 90_000 },
};

function createService({
  syncGroup = jest.fn(async () => ({
    synced: true,
    chainTip: 100,
    caughtUpAccountIds: [accountId],
  })),
  syncPolicy = sendSyncPolicy,
  accountState = { enabled: true, paused: false },
}: {
  syncGroup?: jest.Mock;
  syncPolicy?: ILocalWalletSyncPolicy;
  accountState?: ILocalWalletAccountState;
} = {}) {
  mockGetChainOnlyVault.mockResolvedValue({
    getLocalWalletCapability: () => ({
      listAccounts: async () => ({
        accounts: [{ accountId, runtimeKey: 'main', syncEnabled: true }],
      }),
      getChainTip: async () => 100,
      syncPolicy,
      syncGroup,
      isLocalScanTransaction: (tx: { zcashMode?: string }) =>
        tx.zcashMode === 'privacy',
      syncCompletionIsAuthoritative: true,
      recoverFromTimeout: async () => false,
    }),
  });
  const service = Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    {
      backgroundApi: {
        serviceCustomRpc: {
          ensureLocalWalletRemoteConfigLoaded: async () => undefined,
        },
        simpleDb: {
          privacyChainState: { getAccountEpoch: async () => undefined },
        },
        serviceAccount: {
          getDBAccountSafe: async () => ({ id: accountId }),
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
      getLocalWalletAccountState: jest.fn(async () => accountState),
      refreshLocalWalletAccount: jest.fn(async () => undefined),
      scheduleBackgroundSync: jest.fn(),
      shortenStartupQuietWindow: jest.fn(),
      publishScanProgress: jest.fn(),
      publishBoostingNetworks: jest.fn(),
      refreshAutoBoost: jest.fn(),
      runLocalWalletOrphanCleanupIfDue: jest.fn(),
      doLocalWalletPasswordWork: jest.fn(async () => false),
      init: jest.fn(),
    },
  );
  return { service, syncGroup };
}

const orchard = { networkId, accountId, sourcePool: 'orchard' };

beforeEach(() => {
  mockPublished = mockEmptyState();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sync before a private send', () => {
  it('does not gate or sync a send from a backend pool', async () => {
    const { service } = createService();
    await service.requestLocalWalletSendSync({
      ...orchard,
      sourcePool: 'transparent',
    });
    expect(service.refreshLocalWalletAccount).not.toHaveBeenCalled();
    expect(
      await service.getLocalWalletSendReadiness({
        ...orchard,
        sourcePool: 'transparent',
      }),
    ).toBeUndefined();
  });

  it('does not gate a chain without a send sync policy', async () => {
    const { service } = createService({
      syncPolicy: { ...sendSyncPolicy, sendSync: undefined },
    });
    await service.requestLocalWalletSendSync(orchard);
    expect(service.refreshLocalWalletAccount).not.toHaveBeenCalled();
    expect(await service.getLocalWalletSendReadiness(orchard)).toBeUndefined();
  });

  it('blocks until a pass ending after the request catches the account up', async () => {
    const { service } = createService();
    mockPublished.progress[`${networkId}:${accountId}`] = {
      birthdayHeight: 1,
      backfillScannedHeight: 90,
      backfillTargetHeight: 90,
      backfillProgress: 1,
      isBackfillComplete: true,
      tipScannedHeight: 90,
      chainTip: 100,
      tipLag: 10,
      isTipCaughtUp: false,
      isSyncing: false,
    };
    await service.requestLocalWalletSendSync(orchard);
    expect(service.refreshLocalWalletAccount).toHaveBeenCalledWith({
      networkId,
      accountId,
    });
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual({
      blocksLeft: 10,
      canSend: false,
      paused: false,
      syncError: undefined,
    });

    await service.backgroundSyncTick();
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual(
      expect.objectContaining({ canSend: true }),
    );

    // Entering again asks for a newer pass.
    // Even re-entering in the same millisecond requires another completed pass.
    await service.requestLocalWalletSendSync(orchard);
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual(
      expect.objectContaining({ canSend: false }),
    );
  });

  it('revokes a completed send sync when the server disables privacy', async () => {
    const { service } = createService();
    await service.requestLocalWalletSendSync(orchard);
    await service.backgroundSyncTick();
    expect(await service.getLocalWalletSendReadiness(orchard)).toMatchObject({
      canSend: true,
    });
    setLocalWalletRemoteConfigs({ [networkId]: { privacyDisabled: true } });
    try {
      expect(await service.getLocalWalletSendReadiness(orchard)).toEqual({
        blocksLeft: null,
        canSend: false,
        paused: true,
      });
    } finally {
      setLocalWalletRemoteConfigs({});
    }
  });

  it('keeps a disabled private account blocked', async () => {
    const { service } = createService({
      accountState: { enabled: false, paused: true },
    });
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual({
      blocksLeft: null,
      canSend: false,
      paused: true,
    });
  });

  it('runs another pass when the requested one did not reach the tip', async () => {
    const syncGroup = jest
      .fn()
      .mockResolvedValueOnce({ synced: true, chainTip: 100 })
      .mockResolvedValue({
        synced: true,
        chainTip: 100,
        caughtUpAccountIds: [accountId],
      });
    const { service } = createService({ syncGroup });
    await service.requestLocalWalletSendSync(orchard);

    await service.backgroundSyncTick();
    expect(service.runtimeSyncState.has(stateKey)).toBe(false);
    expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(3000);

    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(2);
    expect(service.runtimeSyncState.has(stateKey)).toBe(true);
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual(
      expect.objectContaining({ canSend: true }),
    );
  });

  it('reports a paused network and the last sync error while waiting', async () => {
    const { service } = createService();
    await service.requestLocalWalletSendSync(orchard);
    service.boostPausedByNetwork[networkId] = true;
    mockPublished.syncErrorByNetworkId[networkId] = 'nodeUnreachable';
    expect(await service.getLocalWalletSendReadiness(orchard)).toEqual({
      blocksLeft: null,
      canSend: false,
      paused: true,
      syncError: 'nodeUnreachable',
    });
  });
});

describe('syncs after a private broadcast', () => {
  it('syncs at once, then at the policy interval, then stops', async () => {
    const start = 1_700_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    const { service, syncGroup } = createService();
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(1);

    await service.onLocalWalletTransactionBroadcast({
      networkId,
      encodedTx: { zcashMode: 'privacy' },
    });
    expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(0);

    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(2);
    expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(90_000);

    // Unchanged tip and nothing due: no pass.
    now.mockReturnValue(start + 30_000);
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(2);

    now.mockReturnValue(start + 90_000);
    await service.backgroundSyncTick();
    now.mockReturnValue(start + 180_000);
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(4);

    service.scheduleBackgroundSync.mockClear();
    now.mockReturnValue(start + 270_000);
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(4);
    expect(service.scheduleBackgroundSync).not.toHaveBeenCalled();
  });

  it('ignores a broadcast the scan does not need to find', async () => {
    const { service } = createService();
    await service.onLocalWalletTransactionBroadcast({
      networkId,
      encodedTx: { zcashMode: 'transparent' },
    });
    expect(service.scheduleBackgroundSync).not.toHaveBeenCalled();
  });
});

describe('activation telemetry', () => {
  function stubEnable(service: IService, enable: jest.Mock) {
    Object.assign(service, {
      getSyncSlotMutex: () => ({
        runExclusive: (fn: () => Promise<void>) => fn(),
      }),
      enableLocalWalletAccountInSlot: enable,
      claimSyncSlot: jest.fn(),
    });
  }

  it('reports an activation and its first caught-up pass, without account data', async () => {
    const start = 1_700_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    const { service } = createService({
      accountState: { enabled: false, paused: false },
    });
    stubEnable(service, jest.fn());
    await service.enableLocalWalletAccount({ networkId, accountId });
    expect(mockPrivacyChainLogger.privacyEnabled).toHaveBeenCalledWith({
      networkId,
      walletType: 'hd',
    });

    now.mockReturnValue(start + 10 * 60_000);
    await service.backgroundSyncTick();
    await service.backgroundSyncTick();
    expect(
      mockPrivacyChainLogger.privacyFirstSyncCompleted,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockPrivacyChainLogger.privacyFirstSyncCompleted,
    ).toHaveBeenCalledWith({
      networkId,
      walletType: 'hd',
      durationBucket: '5m_30m',
    });
  });

  it('reports the first failure once and still reports a later completion', async () => {
    const syncGroup = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new OneKeyLocalError('offline'), {
          code: 'NETWORK_ERROR',
        }),
      )
      .mockRejectedValueOnce(new OneKeyLocalError('again'))
      .mockResolvedValue({
        synced: true,
        chainTip: 100,
        caughtUpAccountIds: [accountId],
      });
    const { service } = createService({
      syncGroup,
      accountState: { enabled: false, paused: false },
    });
    stubEnable(service, jest.fn());
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.enableLocalWalletAccount({ networkId, accountId });

    await service.backgroundSyncTick();
    Object.assign(service, { syncFailureBackoff: new Map() });
    await service.backgroundSyncTick();
    Object.assign(service, { syncFailureBackoff: new Map() });
    await service.backgroundSyncTick();
    expect(mockPrivacyChainLogger.privacyFirstSyncFailed).toHaveBeenCalledTimes(
      1,
    );
    expect(mockPrivacyChainLogger.privacyFirstSyncFailed).toHaveBeenCalledWith({
      networkId,
      walletType: 'hd',
      durationBucket: 'under_5m',
      reason: 'node_unreachable',
    });
    expect(
      mockPrivacyChainLogger.privacyFirstSyncCompleted,
    ).toHaveBeenCalledTimes(1);
  });

  it('reports a failed activation with its category', async () => {
    const { service } = createService({
      accountState: { enabled: false, paused: false },
    });
    stubEnable(
      service,
      jest.fn(async () => {
        throw Object.assign(new OneKeyLocalError('cancelled'), {
          className: 'PasswordPromptDialogCancel',
        });
      }),
    );
    await expect(
      service.enableLocalWalletAccount({ networkId, accountId }),
    ).rejects.toThrow('cancelled');
    expect(mockPrivacyChainLogger.privacyEnableFailed).toHaveBeenCalledWith({
      networkId,
      walletType: 'hd',
      reason: 'user_cancelled',
    });
    await service.backgroundSyncTick();
    expect(
      mockPrivacyChainLogger.privacyFirstSyncCompleted,
    ).not.toHaveBeenCalled();
  });

  it('does not count resuming a paused account as an activation', async () => {
    const { service } = createService({
      accountState: { enabled: false, paused: true },
    });
    stubEnable(service, jest.fn());
    await service.enableLocalWalletAccount({ networkId, accountId });
    await service.backgroundSyncTick();
    expect(mockPrivacyChainLogger.privacyEnabled).not.toHaveBeenCalled();
    expect(
      mockPrivacyChainLogger.privacyFirstSyncCompleted,
    ).not.toHaveBeenCalled();
  });
});
