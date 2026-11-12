import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { privacyChainAtom } from '../states/jotai/atoms';

import type { ILocalWalletCapability } from '../vaults/localWallet/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const mockGetChainOnlyVault = jest.fn();
const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: mockGetChainOnlyVault,
    getVault: mockGetVault,
  },
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: {
    set: jest.fn(async () => undefined),
    get: jest.fn(async () => ({ progress: {} })),
  },
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
    terminated: boolean | (() => Promise<boolean>) = false,
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
        recoverFromTimeout:
          typeof terminated === 'function'
            ? terminated
            : async () => terminated,
        isUserOperationActive,
      }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        backgroundSyncTick: () => Promise<void>;
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
        quarantineRecoveries: new Map<string, () => Promise<void>>(),
        storageUnsupportedNetworkIds: new Set<string>(),
        syncFailureBackoff: new Map(),
        runtimeSyncState: new Map(),
        orphanCleanupGeneration: new Map<string, number>(),
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

  it('quarantines a timed-out writer even when publishing its error fails', async () => {
    const { service, syncGroup, resolveSync } = createService(true);
    jest
      .spyOn(privacyChainAtom, 'set')
      .mockRejectedValueOnce(new OneKeyLocalError('state publication failed'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);
    expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(30_000);

    await service.backgroundSyncTick();
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);
    expect(syncGroup).toHaveBeenCalledTimes(1);

    resolveSync(result);
    await jest.advanceTimersByTimeAsync(0);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
    expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(0);
    await service.backgroundSyncTick();
    expect(syncGroup).toHaveBeenCalledTimes(2);
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

  // A carrier that could not be replaced stays quarantined; without a retry, the chain waits for a
  // restart.
  it('retries a failed recovery, slower each time, until it works', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const recover = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValueOnce(new Error('WebEmbed did not answer reset'))
      .mockRejectedValueOnce(new Error('WebEmbed did not answer reset'))
      .mockResolvedValue(true);
    const { service } = createService(false, recover);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(recover).toHaveBeenCalledTimes(1);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);

    await jest.advanceTimersByTimeAsync(29_000);
    expect(recover).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(recover).toHaveBeenCalledTimes(2);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);

    await jest.advanceTimersByTimeAsync(59_000);
    expect(recover).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1000);
    expect(recover).toHaveBeenCalledTimes(3);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);

    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(recover).toHaveBeenCalledTimes(3);
    // Only the first attempt may replace the carrier other features share.
    expect(recover.mock.calls).toEqual([
      [{ remountCarrier: true }],
      [{ remountCarrier: false }],
      [{ remountCarrier: false }],
    ]);
  });

  // A recovery resets the runtime's Worker; a send running on it would lose its calls.
  it('holds a recovery while a user send runs and retries once it ends', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let sending = false;
    const recover = jest
      .fn<Promise<boolean>, [{ remountCarrier?: boolean }?]>()
      .mockRejectedValueOnce(new Error('WebEmbed did not answer reset'))
      .mockResolvedValue(true);
    const { service } = createService(false, recover, () => sending);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(recover).toHaveBeenCalledTimes(1);

    // The send starts after the first recovery failed; its retry must not reset under it.
    sending = true;
    await jest.advanceTimersByTimeAsync(30_000);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);

    sending = false;
    await jest.advanceTimersByTimeAsync(30_000);
    expect(recover).toHaveBeenCalledTimes(2);
    expect(recover.mock.calls[1]).toEqual([{ remountCarrier: false }]);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(false);
  });

  // A paused chain is not scanning; its Continue starts the recovery again.
  it('stops retrying a failed recovery while the chain is paused', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const recover = jest
      .fn<Promise<boolean>, [{ remountCarrier?: boolean }?]>()
      .mockRejectedValue(new Error('WebEmbed did not answer reset'));
    const { service } = createService(false, recover);
    const tick = service.backgroundSyncTick();
    await jest.advanceTimersByTimeAsync(11);
    await tick;
    expect(recover).toHaveBeenCalledTimes(1);

    Object.assign(service, { boostPausedByNetwork: { [networkId]: true } });
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(service.quarantinedSyncs.has(stateKey)).toBe(true);
  });

  it.each([
    { outcome: 'replaced', stuck: false },
    { outcome: 'still stuck', stuck: true },
  ])(
    'replaces a stuck runtime at once when the user starts a sync ($outcome)',
    async ({ stuck }) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const recover = jest
        .fn<Promise<boolean>, []>()
        .mockRejectedValueOnce(new Error('WebEmbed did not answer reset'));
      if (stuck) {
        recover.mockRejectedValue(new Error('WebEmbed did not answer reset'));
      } else {
        recover.mockResolvedValue(true);
      }
      const { service } = createService(false, recover);
      const tick = service.backgroundSyncTick();
      await jest.advanceTimersByTimeAsync(11);
      await tick;
      expect(recover).toHaveBeenCalledTimes(1);
      const publishSyncError = jest.fn(async () => undefined);
      Object.assign(service, {
        publishSyncError,
        setChainPaused: jest.fn(async () => undefined),
        setAccountsPreparing: jest.fn(async () => undefined),
        requestForegroundScan: jest.fn(async () => undefined),
      });

      await (
        service as unknown as {
          startUserSync: (params: {
            networkId: string;
            accountId: string;
          }) => Promise<void>;
        }
      ).startUserSync({ networkId, accountId: 'account' });
      await jest.advanceTimersByTimeAsync(0);

      expect(recover).toHaveBeenCalledTimes(2);
      expect(service.quarantinedSyncs.has(stateKey)).toBe(stuck);
      expect(publishSyncError).toHaveBeenLastCalledWith(
        networkId,
        stuck ? 'runtimeUnavailable' : undefined,
      );
    },
  );

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

  // A failed turn never records the chain tip, so without backoff the failing group stays `tip` and
  // outranks the other chain's backfill.
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
      // The chains' real rests: Zcash 0.5s watched, 30s in a phone's background; Monero 0.25s / 5s.
      syncPolicy: {
        maxSyncDurationMs: 60_000,
        foregroundBackfillDelayMs: networkId === 'zec--0' ? 500 : 250,
        backgroundBackfillDelayMs:
          networkId === 'zec--0'
            ? { desktop: 5000, default: 30_000 }
            : { desktop: 1500, default: 5000 },
      },
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
        orphanCleanupGeneration: new Map<string, number>(),
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

  // Without this the failing chain waits for the periodic check, minutes later.
  it('wakes a backed-off chain when its wait ends, after another chain took the turn', async () => {
    const zcashSync = jest.fn().mockRejectedValue(new Error('NETWORK_ERROR'));
    const xmrSync = jest.fn().mockResolvedValue({
      synced: true,
      chainTip: 200,
      backfillRemaining: false,
    });
    const service = createTwoChainScheduler(zcashSync, xmrSync) as unknown as {
      backgroundSyncTick: () => Promise<void>;
      scheduleBackgroundSync: jest.Mock;
    };

    await service.backgroundSyncTick();
    service.scheduleBackgroundSync.mockClear();
    await service.backgroundSyncTick();

    expect(xmrSync).toHaveBeenCalledTimes(1);
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(5000);
  });

  // Only background scanning backs off for minutes; a chain the user watches retries within 30s.
  it.each([
    [false, 5 * 60 * 1000],
    [true, 30 * 1000],
  ])(
    'caps the wait of a watched chain (watched: %s)',
    async (watched, wait) => {
      const service = createTwoChainScheduler(
        jest.fn(),
        jest.fn().mockResolvedValue({ synced: true, chainTip: 200 }),
      ) as unknown as {
        backgroundSyncTick: () => Promise<void>;
        recordSyncFailure: (key: string) => void;
        scheduleBackgroundSync: jest.Mock;
        isNetworkForegroundHot: (networkId: string) => boolean;
      };
      for (let i = 0; i < 8; i += 1) service.recordSyncFailure('zec--0|main');
      service.isNetworkForegroundHot = (networkId) =>
        watched && networkId === 'zec--0';

      await service.backgroundSyncTick();

      expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(wait);
    },
  );

  describe('two chains backfilling', () => {
    type IScheduler = {
      backgroundSyncTick: () => Promise<void>;
      scheduleBackgroundSync: jest.Mock;
      runtimeSyncState: Map<string, unknown>;
      isNetworkForegroundHot: (networkId: string) => boolean;
    };
    const backfilling = () =>
      jest.fn().mockResolvedValue({
        synced: true,
        chainTip: 200,
        backfillRemaining: true,
      });

    // Zcash takes the first turn (its tip moved), Monero the second; both still have blocks left.
    async function afterOneTurnEach() {
      const zcashSync = backfilling();
      const xmrSync = backfilling();
      const service = createTwoChainScheduler(
        zcashSync,
        xmrSync,
      ) as unknown as IScheduler;
      await service.backgroundSyncTick();
      await service.backgroundSyncTick();
      expect(zcashSync).toHaveBeenCalledTimes(1);
      expect(xmrSync).toHaveBeenCalledTimes(1);
      return { service, zcashSync, xmrSync };
    }

    // Swapping every second would keep a phone scanning nonstop in the background.
    it('lets each chain rest at its own background pace', async () => {
      const { service, zcashSync, xmrSync } = await afterOneTurnEach();
      expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(5000);

      await service.backgroundSyncTick();
      expect(zcashSync).toHaveBeenCalledTimes(1);
      expect(xmrSync).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + 5000);
      await service.backgroundSyncTick();
      expect(xmrSync).toHaveBeenCalledTimes(2);
      expect(zcashSync).toHaveBeenCalledTimes(1);
    });

    it('scans a new tip at once, even while the chain rests', async () => {
      const { service, zcashSync } = await afterOneTurnEach();
      service.runtimeSyncState.set('zec--0|main', {
        accountSignature: 'zec--0-account',
        lastChainTip: 100,
      });

      await service.backgroundSyncTick();

      expect(zcashSync).toHaveBeenCalledTimes(2);
    });

    it('keeps a watched chain moving at its foreground pace', async () => {
      const { service, zcashSync } = await afterOneTurnEach();
      service.isNetworkForegroundHot = (networkId) => networkId === 'zec--0';

      await service.backgroundSyncTick();
      expect(service.scheduleBackgroundSync).toHaveBeenLastCalledWith(1000);
      jest.setSystemTime(Date.now() + 1000);
      await service.backgroundSyncTick();

      expect(zcashSync).toHaveBeenCalledTimes(2);
    });
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

// The user's own entry (enable, Sync, a rescan) shows the scan; the notice only queues a pass.
describe('Privacy accounts-changed notice', () => {
  it.each([false, true])(
    'queues a pass without requesting the light or touching a pause (paused: %s)',
    async (paused) => {
      const publishBoostingNetworks = jest.fn();
      const scheduleBackgroundSync = jest.fn();
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
          scheduleBackgroundSync,
          publishBoostingNetworks,
        },
      );
      await service.onLocalWalletAccountsChanged({
        networkId: 'zec--0',
        accountIds: ['account'],
        backfillActive: true,
      });
      expect(service.backfillActiveByAccount.account).toBe(true);
      expect(scheduleBackgroundSync).toHaveBeenCalledWith(0);
      expect(
        service.foregroundBoostRequestedByNetwork['zec--0'],
      ).toBeUndefined();
      expect(service.boostPausedByNetwork['zec--0']).toBe(paused);
      expect(publishBoostingNetworks).not.toHaveBeenCalled();
    },
  );
});

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
        presetLocalWalletNetworkIds: Promise.resolve(['zec--0']),
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

  // A delisted network only pauses scanning; App Reset still wipes it.
  it('wipes a delisted network too', async () => {
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
        getLocalWalletNetworkIds: async () => ['zec--0'],
      },
    );

    await expect(service.dropAllLocalWalletData()).resolves.toEqual([]);
    expect(dropped).toEqual(['zec--0', 'xmr--0']);
    mockGetChainOnlyVault.mockReset();
  });
});

describe('wallet creation provenance', () => {
  it('reaches a delisted chain too', async () => {
    const onWalletCreated = jest.fn(async () => undefined);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({ onWalletCreated }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        getLocalWalletNetworkIds: async () => [],
        presetLocalWalletNetworkIds: Promise.resolve(['zec--0']),
      },
    );
    const params = {
      walletId: 'hd-1',
      isFreshlyGeneratedMnemonic: true,
      createdAt: 1,
    };

    await service.onWalletCreated(params);

    expect(mockGetChainOnlyVault).toHaveBeenCalledWith({ networkId: 'zec--0' });
    expect(onWalletCreated).toHaveBeenCalledWith(params);
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

// An open privacy page is a waiting user: the startup quiet window shrinks to its floor, and nothing
// lights up.
describe('Privacy page opened', () => {
  function createService() {
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        serviceBootAt: Date.now(),
        earliestTickAt: Date.now() + 60_000,
        getLocalWalletNetworkIds: async () => ['zec--0'],
        init: jest.fn(async () => undefined),
        scheduleBackgroundSync: jest.fn(),
        publishBoostingNetworks: jest.fn(),
        foregroundBoostRequestedByNetwork: {},
      },
    );
  }

  it('schedules a pass, waiting only for the startup floor', async () => {
    const service = createService();
    await service.onLocalWalletPageOpened({ networkId: 'zec--0' });
    expect(service.earliestTickAt).toBe(service.serviceBootAt + 30_000);
    expect(service.scheduleBackgroundSync).toHaveBeenCalledWith(0);
    expect(service.foregroundBoostRequestedByNetwork).toEqual({});
    expect(service.publishBoostingNetworks).not.toHaveBeenCalled();
  });

  it('does nothing for a network without local scanning', async () => {
    const service = createService();
    const quietUntil = service.earliestTickAt;
    await service.onLocalWalletPageOpened({ networkId: 'evm--1' });
    expect(service.earliestTickAt).toBe(quietUntil);
    expect(service.scheduleBackgroundSync).not.toHaveBeenCalled();
  });
});

// A runtime starting or running a turn answers late; no page read waits on it past the display wait.
describe('Privacy page reads while the runtime is held', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    mockGetChainOnlyVault.mockReset();
  });

  function createService() {
    const never = () => new Promise<never>(() => {});
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        getSyncProgress: never,
        getStorageUsage: never,
        getSyncEndpoint: async () => ({ url: 'https://node.example' }),
      }),
    });
    return Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        backgroundApi: {
          serviceCustomRpc: {
            resolveDefaultRpcUrl: async () => 'https://node.example',
          },
        },
      },
    );
  }

  it('answers sync progress for an account with nothing published yet', async () => {
    const progress = createService().getLocalWalletSyncProgress({
      networkId: 'zec--held',
      accountId: 'account',
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(progress).resolves.toBeUndefined();
  });

  // Unknown, not absent: an absent size hides the reset button exactly when it may be needed.
  it('answers the network page with the size unknown and the node shown', async () => {
    const info = createService().getLocalWalletNetworkInfo({
      networkId: 'zec--held',
    });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(info).resolves.toMatchObject({
      storageBytes: null,
      endpointUrl: 'https://node.example',
    });
  });
});
