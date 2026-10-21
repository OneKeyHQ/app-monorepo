import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

import { SimpleDbEntityPrivacyChainJournal } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainKeys } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

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
const mockGetVaultSettings = jest.fn();
jest.mock('../vaults/settings', () => ({
  getVaultSettings: (params: { networkId: string }) =>
    mockGetVaultSettings(params) as Promise<{ localWallet?: unknown }>,
}));
jest.mock('../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

const ServicePrivacyChain = require('./ServicePrivacyChain')
  .default as typeof import('./ServicePrivacyChain').default;

type IService = InstanceType<typeof ServicePrivacyChain>;

const networkId = 'xmr--0';
const liveAccountId = 'hd-1--0';
const removedAccountId = 'hd-1--1';
// Locked passphrase wallets are hidden from getWallets() but stay on disk.
const hiddenAccountId = 'hd-2--0';

function accountRow(id: string) {
  return { id, indexedAccountId: `${id}--indexed` };
}

function createPrivacyChainDb(initial?: unknown) {
  let saved: unknown = initial ?? null;
  const entity = new SimpleDbEntityPrivacyChainState();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function createKeysDb(accountIds: string[]) {
  let saved: unknown = {
    data: {
      keys: Object.fromEntries(
        accountIds.map((id) => [
          id,
          {
            networkId,
            vkFp: 'a'.repeat(32),
            sealed: { format: 'plain', value: id },
          },
        ]),
      ),
    },
    updatedAt: 1,
  };
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function createJournalDb(accountIds: string[] = []) {
  let saved: unknown = {
    data: {
      zcashTransparent: {},
      xmrSent: Object.fromEntries(
        accountIds.map((id) => [id, { tx: { recipient: `4${id}` } }]),
      ),
    },
    updatedAt: 1,
  };
  const entity = new SimpleDbEntityPrivacyChainJournal();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
  };
  return entity;
}

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushPromises() {
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function createService(overrides: Record<string, unknown>): IService {
  return Object.assign(
    Object.create(ServicePrivacyChain.prototype) as IService,
    overrides,
  );
}

describe('removed-account gc', () => {
  function createGcHarness(
    getAllAccounts: () => Promise<{
      accounts: { id: string; indexedAccountId?: string }[];
    }>,
    indexedAccountIds: string[] = [
      liveAccountId,
      removedAccountId,
      hiddenAccountId,
    ].map((id) => accountRow(id).indexedAccountId),
  ) {
    const reset = jest.fn(async () => undefined);
    const gcWalletState = jest.fn(async () => undefined);
    const privacyChainKeys = createKeysDb([
      liveAccountId,
      removedAccountId,
      hiddenAccountId,
    ]);
    const removeLastBalances = jest.fn(async () => undefined);
    const privacyChainJournal = createJournalDb([
      liveAccountId,
      removedAccountId,
      hiddenAccountId,
    ]);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds: [liveAccountId, removedAccountId, hiddenAccountId],
        }),
        reset,
        gcWalletState,
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(getAllAccounts),
      getAllIndexedAccounts: jest.fn(async () => ({
        indexedAccounts: indexedAccountIds.map((id) => ({ id })),
      })),
      // A per-id read would report every one of these as missing.
      getDBAccountSafe: jest.fn(async () => undefined),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
    };
    const service = createService({
      gcRunning: false,
      gcRequested: false,
      orphanCleanupGeneration: new Map<string, number>(),
      backgroundApi: {
        serviceAccount,
        simpleDb: {
          privacyChainKeys,
          privacyChainCache: {
            listLastBalanceAccountIds: async () => [
              liveAccountId,
              removedAccountId,
            ],
            removeLastBalances,
          },
          privacyChainJournal,
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
      forEachLocalWalletCapability: async (
        fn: (capability: unknown) => Promise<void>,
      ) => fn({ gcWalletState }),
    });
    return {
      service,
      serviceAccount,
      reset,
      gcWalletState,
      privacyChainKeys,
      privacyChainJournal,
      removeLastBalances,
    };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetChainOnlyVault.mockReset();
  });

  it('purges nothing when the account list cannot be read', async () => {
    const {
      service,
      reset,
      gcWalletState,
      privacyChainKeys,
      privacyChainJournal,
      removeLastBalances,
    } = createGcHarness(async () => {
      throw new OneKeyLocalError('database is locked');
    });

    await service.gcRemovedAccounts();

    expect(reset).not.toHaveBeenCalled();
    expect(gcWalletState).not.toHaveBeenCalled();
    expect(removeLastBalances).not.toHaveBeenCalled();
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      liveAccountId,
      removedAccountId,
      hiddenAccountId,
    ]);
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual([
      liveAccountId,
      removedAccountId,
      hiddenAccountId,
    ]);
    expect(service.gcRunning).toBe(false);
  });

  it('purges an account that is definitely gone', async () => {
    const {
      service,
      reset,
      privacyChainKeys,
      privacyChainJournal,
      removeLastBalances,
    } = createGcHarness(async () => ({
      accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
    }));

    await service.gcRemovedAccounts();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith({
      accountId: removedAccountId,
      scope: 'all',
    });
    // The account set changed: the runtime orphan cleanup is due again.
    expect(service.orphanCleanupGeneration.get(networkId)).toBe(1);
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      liveAccountId,
      hiddenAccountId,
    ]);
    expect(removeLastBalances).toHaveBeenCalledWith({
      accountIds: [removedAccountId],
    });
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual([
      liveAccountId,
      hiddenAccountId,
    ]);
  });

  it('keeps a hidden or locked passphrase wallet account', async () => {
    const { service, serviceAccount, reset } = createGcHarness(async () => ({
      accounts: [
        accountRow(liveAccountId),
        accountRow(removedAccountId),
        accountRow(hiddenAccountId),
      ],
    }));

    await service.gcRemovedAccounts();

    // Unfiltered: filterRemoved would drop locked passphrase wallets.
    expect(serviceAccount.getAllAccounts).toHaveBeenCalledWith();
    expect(reset).not.toHaveBeenCalled();
    expect(service.orphanCleanupGeneration.get(networkId)).toBeUndefined();
  });

  // Deleting an HD account removes its indexed account but leaves its rows.
  it('purges an account whose HD account was deleted', async () => {
    const { service, reset, privacyChainKeys } = createGcHarness(
      async () => ({
        accounts: [
          accountRow(liveAccountId),
          accountRow(hiddenAccountId),
          accountRow(removedAccountId),
        ],
      }),
      [liveAccountId, hiddenAccountId].map(
        (id) => accountRow(id).indexedAccountId,
      ),
    );

    await service.gcRemovedAccounts();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith({
      accountId: removedAccountId,
      scope: 'all',
    });
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      liveAccountId,
      hiddenAccountId,
    ]);
  });

  it('keeps an imported account, which has no indexed account', async () => {
    const importedAccountId = 'imported--0';
    const { service, reset } = createGcHarness(async () => ({
      accounts: [
        accountRow(liveAccountId),
        accountRow(removedAccountId),
        accountRow(hiddenAccountId),
        { id: importedAccountId },
      ],
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds: [importedAccountId],
        }),
        reset,
      }),
    });

    await service.gcRemovedAccounts();

    expect(reset).not.toHaveBeenCalled();
  });

  function createEmptyGcHarness() {
    const gcWalletState = jest.fn(async () => undefined);
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
        reset: jest.fn(),
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(async () => ({ accounts: [] })),
      getAllIndexedAccounts: jest.fn(async () => ({ indexedAccounts: [] })),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
    };
    const service = createService({
      gcRunning: false,
      gcRequested: false,
      orphanCleanupGeneration: new Map<string, number>(),
      backgroundApi: {
        serviceAccount,
        simpleDb: {
          privacyChainKeys: createKeysDb([]),
          privacyChainCache: {
            listLastBalanceAccountIds: async () => [],
            removeLastBalances: jest.fn(),
          },
          privacyChainJournal: createJournalDb(),
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
      forEachLocalWalletCapability: async (
        fn: (capability: unknown) => Promise<void>,
      ) => fn({ gcWalletState }),
    });
    return { service, serviceAccount, gcWalletState };
  }

  it('reads no accounts when there is nothing to purge', async () => {
    const { service, serviceAccount, gcWalletState } = createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(serviceAccount.getAllIndexedAccounts).not.toHaveBeenCalled();
    expect(gcWalletState).toHaveBeenCalledWith({ liveWalletIds: [] });
  });

  it('keeps wallet state while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, gcWalletState } = createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(gcWalletState).not.toHaveBeenCalled();
  });

  it('purges nothing while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, serviceAccount, reset, gcWalletState } = createGcHarness(
      async () => ({ accounts: [] }),
    );

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(gcWalletState).not.toHaveBeenCalled();
  });
});

describe('pending local data drop retry', () => {
  function createRetryHarness({
    pending,
    cleanupAccountIds = [],
    storedAccountIds,
    dropLocalData = jest.fn(async () => undefined),
  }: {
    pending: string[];
    cleanupAccountIds?: string[];
    storedAccountIds?: string[];
    dropLocalData?: jest.Mock;
  }) {
    const privacyChain = createPrivacyChainDb({
      data: { pendingLocalDataDrop: pending },
      updatedAt: 1,
    });
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds,
          storedAccountIds,
        }),
        dropLocalData,
      }),
    });
    const service = createService({
      backgroundApi: { simpleDb: { privacyChainState: privacyChain } },
    });
    return { service, privacyChain, dropLocalData };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockGetChainOnlyVault.mockReset();
  });

  it('wipes a pending network and clears its mark', async () => {
    const { service, privacyChain, dropLocalData } = createRetryHarness({
      pending: [networkId],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).toHaveBeenCalledTimes(1);
    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([]);
  });

  it('keeps the mark when the wipe fails', async () => {
    const { service, privacyChain } = createRetryHarness({
      pending: [networkId],
      dropLocalData: jest.fn(async () => {
        throw new OneKeyLocalError('storage busy');
      }),
    });

    await service.retryPendingLocalDataDrop();

    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([
      networkId,
    ]);
  });

  it('leaves a network alone once it holds state again', async () => {
    const { service, privacyChain, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).not.toHaveBeenCalled();
    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([
      networkId,
    ]);
  });

  // A record left by a cancelled enable or a deletion holds no data.
  it('wipes a network whose accounts hold no stored data', async () => {
    const { service, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
      storedAccountIds: [],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).toHaveBeenCalledTimes(1);
  });

  it('keeps a network an account stores data in', async () => {
    const { service, dropLocalData } = createRetryHarness({
      pending: [networkId],
      cleanupAccountIds: [liveAccountId],
      storedAccountIds: [liveAccountId],
    });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).not.toHaveBeenCalled();
  });

  it('starts from init without holding it up', async () => {
    const retry = deferred();
    const retryPendingLocalDataDrop = jest.fn(() => retry.promise);
    const service = createService({
      initialized: false,
      initPromise: undefined,
      isPrivacySyncOnCellularAllowed: async () => false,
      gcRemovedAccounts: jest.fn(async () => undefined),
      retryPendingLocalDataDrop,
      scheduleBackgroundSync: jest.fn(),
      resumePendingLocalWalletOperations: jest.fn(async () => undefined),
    });

    try {
      await service.init();
      expect(retryPendingLocalDataDrop).toHaveBeenCalledTimes(1);
      expect(service.pendingLocalDataDropRetry).toBeDefined();

      retry.resolve();
      await flushPromises();
      expect(service.pendingLocalDataDropRetry).toBeUndefined();
    } finally {
      clearInterval(service.periodicSyncTimer);
    }
  });

  it('holds the first sync tick until the wipe settles', async () => {
    const retry = deferred();
    const isLocalWalletScanAllowed = jest.fn(async () => false);
    const service = createService({
      syncTickRunning: false,
      syncTickRequested: false,
      pendingLocalDataDropRetry: retry.promise,
      isLocalWalletScanAllowed,
      publishHeldScanProgress: jest.fn(async () => undefined),
      scheduleBackgroundSync: jest.fn(),
    });

    const tick = service.backgroundSyncTick();
    await flushPromises();
    expect(isLocalWalletScanAllowed).not.toHaveBeenCalled();

    retry.resolve();
    await tick;
    expect(isLocalWalletScanAllowed).toHaveBeenCalledTimes(1);
  });

  it('holds an enable until the wipe settles', async () => {
    const retry = deferred();
    const enableAccount = jest.fn(async () => undefined);
    mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
    const service = createService({
      enableMutexByNetwork: new Map<string, Mutex>(),
      pendingLocalDataDropRetry: retry.promise,
      requireAccountCapability: async () => ({ enableAccount }),
      backgroundApi: {
        serviceAccount: { getWalletSafe: async () => ({ isTemp: false }) },
      },
    });

    const enable = service.enableLocalWalletAccount({
      networkId,
      accountId: liveAccountId,
    });
    await flushPromises();
    expect(enableAccount).not.toHaveBeenCalled();

    retry.resolve();
    await enable;
    expect(enableAccount).toHaveBeenCalledTimes(1);
  });
});

describe.each(['zec--0', 'xmr--0'])(
  'deleting local data on %s',
  (chainNetworkId) => {
    function createDeleteHarness(state: {
      enabled: boolean;
      pendingOperation?: 'enable' | 'disable';
    }) {
      const calls: string[] = [];
      const capability = {
        getAccountState: jest.fn(async () => state),
        disableAccount: jest.fn(async () => {
          calls.push('disable');
        }),
        deleteAccountData: jest.fn(async () => {
          calls.push('delete');
        }),
      };
      mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
      const privacyChainKeys = createKeysDb([liveAccountId, hiddenAccountId]);
      const service = createService({
        backgroundApi: { simpleDb: { privacyChainKeys } },
        enableMutexByNetwork: new Map<string, Mutex>(),
        orphanCleanupGeneration: new Map<string, number>(),
        requireAccountCapability: async () => capability,
        forgetCachedLocalWalletBalance: jest.fn(async () => undefined),
      });
      return { service, capability, calls, privacyChainKeys };
    }

    it('turns an enabled account off before deleting', async () => {
      const { service, calls } = createDeleteHarness({ enabled: true });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });

      expect(calls).toEqual(['disable', 'delete']);
      // The account set changed: the runtime orphan cleanup is due again.
      expect(service.orphanCleanupGeneration.get(chainNetworkId)).toBe(1);
    });

    it('finishes an interrupted operation through the same disable', async () => {
      const { service, calls } = createDeleteHarness({
        enabled: false,
        pendingOperation: 'enable',
      });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });

      expect(calls).toEqual(['disable', 'delete']);
    });

    it('deletes an account that is already off directly', async () => {
      const { service, capability, calls, privacyChainKeys } =
        createDeleteHarness({
          enabled: false,
        });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });

      expect(capability.disableAccount).not.toHaveBeenCalled();
      expect(calls).toEqual(['delete']);
      // The viewing key goes with the data on both chains; others stay.
      await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
        hiddenAccountId,
      ]);
    });

    it('does not delete when turning the account off fails', async () => {
      const { service, capability } = createDeleteHarness({ enabled: true });
      capability.disableAccount.mockRejectedValueOnce(
        new Error('birthday missing'),
      );

      await expect(
        service.deleteLocalWalletAccountData({
          networkId: chainNetworkId,
          accountId: liveAccountId,
        }),
      ).rejects.toThrow('birthday missing');
      expect(capability.deleteAccountData).not.toHaveBeenCalled();
    });

    it('keeps the viewing key when deleting the data fails', async () => {
      const { service, capability, privacyChainKeys } = createDeleteHarness({
        enabled: false,
      });
      capability.deleteAccountData.mockRejectedValueOnce(
        new Error('runtime busy'),
      );

      await expect(
        service.deleteLocalWalletAccountData({
          networkId: chainNetworkId,
          accountId: liveAccountId,
        }),
      ).rejects.toThrow('runtime busy');
      await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
        liveAccountId,
        hiddenAccountId,
      ]);
    });

    it('waits for an enable already in progress', async () => {
      const { service, calls } = createDeleteHarness({ enabled: false });
      const enableDone = deferred();
      const mutex = new Mutex();
      service.enableMutexByNetwork.set(chainNetworkId, mutex);
      const holding = mutex.runExclusive(() => enableDone.promise);

      const deleting = service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });
      await flushPromises();
      expect(calls).toEqual([]);

      enableDone.resolve();
      await holding;
      await deleting;
      expect(calls).toEqual(['delete']);
    });
  },
);
