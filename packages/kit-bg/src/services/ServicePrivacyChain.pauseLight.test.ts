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
};

const mockEmptyState = (): IPublished => ({
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
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
            privacyChain: { saveScanPaused: jest.fn(async () => undefined) },
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
      capability: { syncPolicy: { autoBoostMinRemainingBlocks: 10 } },
    });

    expect(service.foregroundBoostRequestedByNetwork[networkId]).toBe(true);
    expect(mockPublished.pausedNetworkIds).toEqual([networkId]);
  });
});

describe('Privacy scan pause persistence', () => {
  const networkId = 'zec--0';

  beforeEach(() => {
    mockPublished = mockEmptyState();
  });

  function createService(stored: Record<string, boolean>) {
    const saveScanPaused = jest.fn(async () => undefined);
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as {
        loadScanPausedNetworks: () => Promise<void>;
        pauseLocalWalletScan: (params: { networkId: string }) => Promise<void>;
        boostPausedByNetwork: Record<string, boolean>;
        scanPauseLoaded: boolean;
      },
      {
        foregroundBoostRequestedByNetwork: {} as Record<string, boolean>,
        boostPausedByNetwork: {} as Record<string, boolean>,
        scanPauseLoaded: false,
        deviceIsCellular: false,
        allowPrivacySyncOnCellularCache: true,
        backgroundApi: {
          simpleDb: {
            privacyChain: {
              saveScanPaused,
              getScanPausedNetworks: jest.fn(async () => stored),
            },
          },
        },
      },
    );
    return { service, saveScanPaused };
  }

  it('writes the pause down so a restart cannot undo it', async () => {
    const { service, saveScanPaused } = createService({});

    await service.pauseLocalWalletScan({ networkId });

    expect(saveScanPaused).toHaveBeenCalledWith({ networkId, paused: true });
  });

  it('comes back paused after a restart', async () => {
    const { service } = createService({ [networkId]: true });

    await service.loadScanPausedNetworks();

    expect(service.boostPausedByNetwork[networkId]).toBe(true);
  });
});
