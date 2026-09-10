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
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getChainOnlyVault: mockGetChainOnlyVault },
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

  function createService(authoritative: boolean, terminated = false) {
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
      }),
    });
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        backgroundSyncTick: () => Promise<void>;
      },
      {
        backgroundApi: {
          serviceAccount: { getDBAccountSafe: async () => ({ id: 'account' }) },
        },
        deviceIsCellular: false,
        syncTickRunning: false,
        syncTickRequested: false,
        quarantinedSyncs: new Map<string, Promise<unknown>>(),
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
