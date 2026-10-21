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

// A scheduled pass that fails must not toast, and must not leave the status
// row reading "Preparing" forever either.
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
  }: {
    syncGroup: jest.Mock;
    getChainTip?: () => Promise<number>;
  }) {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [
            { accountId: 'account', runtimeKey: 'main', syncEnabled: true },
          ],
        }),
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
        startForegroundBoost: (params: {
          networkId: string;
          trigger: 'manual-sync';
        }) => Promise<void>;
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
        publishBoostingNetworks: jest.fn(),
        refreshAutoBoost: jest.fn(),
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
});
