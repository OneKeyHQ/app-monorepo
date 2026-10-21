import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';

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
const mockEmit = jest.fn();
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: jest.requireActual<
    typeof import('@onekeyhq/shared/src/eventBus/appEventBusNames')
  >('@onekeyhq/shared/src/eventBus/appEventBusNames').EAppEventBusNames,
  appEventBus: {
    emit: (...args: unknown[]) => {
      mockEmit(...args);
    },
  },
}));
jest.mock('../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../vaults/settings', () => ({ getVaultSettings: jest.fn() }));
const mockSetProgress = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: (value: unknown) => mockSetProgress(value) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

describe('privacy lifecycle invalidation', () => {
  beforeEach(() => {
    mockEmit.mockReset();
    mockSetProgress.mockReset().mockResolvedValue(undefined);
  });

  it.each(['progress', 'scheduler'])(
    'invalidates retained pages even when %s notification work fails',
    async (failedStep) => {
      const error = new Error(`${failedStep} unavailable`);
      const init = jest.fn().mockResolvedValue(undefined);
      if (failedStep === 'progress') {
        mockSetProgress.mockRejectedValueOnce(error);
      } else {
        init.mockRejectedValueOnce(error);
      }
      const service = Object.assign(
        Object.create(ServicePrivacyChain.prototype) as InstanceType<
          typeof ServicePrivacyChain
        >,
        { backfillActiveByAccount: {}, syncFailureBackoff: new Map(), init },
      );
      const params = {
        networkId: 'zec--0',
        accountIds: ['account-a'],
        backfillActive: false,
      };

      await expect(service.onLocalWalletAccountsChanged(params)).rejects.toBe(
        error,
      );
      expect(mockEmit).toHaveBeenCalledWith(
        EAppEventBusNames.LocalWalletAccountsChanged,
        { networkId: params.networkId, accountIds: params.accountIds },
      );
      expect(mockEmit).toHaveBeenCalledTimes(1);
    },
  );
});

describe('removed-account gc', () => {
  it('runs again when a removal arrives while a pass is running', async () => {
    let releaseFirstPass: () => void = () => {};
    const getLocalWalletNetworkIds = jest
      .fn<Promise<string[]>, []>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirstPass = () => resolve([]);
          }),
      )
      .mockResolvedValue([]);
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        gcRunning: false,
        gcRequested: false,
        getLocalWalletNetworkIds,
        forEachLocalWalletCapability: jest.fn(async () => undefined),
        backgroundApi: {
          serviceAccount: {
            getAllAccounts: async () => ({ accounts: [] }),
            getAllWallets: async () => ({ wallets: [] }),
          },
        },
      },
    );

    const first = service.gcRemovedAccounts();
    while (getLocalWalletNetworkIds.mock.calls.length === 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // The second wallet is removed after the first pass listed accounts.
    await service.gcRemovedAccounts();
    releaseFirstPass();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getLocalWalletNetworkIds).toHaveBeenCalledTimes(2);
  });
});

describe('init', () => {
  function createService(
    resume: (
      service: InstanceType<typeof ServicePrivacyChain>,
    ) => Promise<void>,
  ) {
    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as InstanceType<
        typeof ServicePrivacyChain
      >,
      {
        initialized: false,
        initPromise: undefined,
        backfillActiveByAccount: {},
        syncFailureBackoff: new Map(),
        foregroundBoostRequestedByNetwork: {},
        boostPausedByNetwork: {},
        earliestTickAt: Date.now() + 60_000,
        isPrivacySyncOnCellularAllowed: async () => false,
        gcRemovedAccounts: jest.fn(async () => undefined),
        retryPendingLocalDataDrop: jest.fn(async () => undefined),
        scheduleBackgroundSync: jest.fn(),
        publishBoostingNetworks: jest.fn(async () => undefined),
      },
    );
    service.forEachLocalWalletCapability = jest.fn(() => resume(service));
    return service;
  }

  beforeEach(() => {
    mockEmit.mockReset();
  });

  // A resume (XMR enable retry) notifies accounts changed, which awaits
  // init(); awaiting the resume inside init deadlocked startup.
  it('resolves when a resumed operation re-enters init', async () => {
    let resumed: () => void = () => {};
    const resumeDone = new Promise<void>((resolve) => {
      resumed = resolve;
    });
    const service = createService(async (self) => {
      await self.onLocalWalletAccountsChanged({
        networkId: 'xmr--0',
        accountIds: ['account-a'],
        backfillActive: true,
      });
      resumed();
    });

    try {
      await service.init();
      expect(service.initialized).toBe(true);
      await resumeDone;
      expect(
        jest.mocked(service).forEachLocalWalletCapability.mock.calls,
      ).toHaveLength(1);
      expect(service.foregroundBoostRequestedByNetwork['xmr--0']).toBe(true);
    } finally {
      clearInterval(service.periodicSyncTimer);
    }
  });

  it('does not fail init when resuming pending operations fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createService(() =>
      Promise.reject(new Error('node unreachable')),
    );

    try {
      await expect(service.init()).resolves.toBeUndefined();
      expect(service.initialized).toBe(true);
    } finally {
      clearInterval(service.periodicSyncTimer);
      jest.restoreAllMocks();
    }
  });
});
