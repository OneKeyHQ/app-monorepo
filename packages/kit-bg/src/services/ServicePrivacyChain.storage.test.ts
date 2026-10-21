import { Mutex } from 'async-mutex';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IRuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';

import { SimpleDbEntityPrivacyChainJournal } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainKeys } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { SimpleDbEntityPrivacyChainXmrSent } from '../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';

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

function memoryStorage(initial: unknown) {
  let saved: unknown = initial;
  return {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
}

function createJournalDb(accountIds: string[] = []) {
  const entity = new SimpleDbEntityPrivacyChainJournal();
  (entity as { appStorage: unknown }).appStorage = memoryStorage({
    data: {
      zcashTransparent: Object.fromEntries(
        accountIds.map((id) => [id, { reservations: {}, pendingTxs: {} }]),
      ),
    },
    updatedAt: 1,
  });
  return entity;
}

function createXmrSentDb(accountIds: string[] = []) {
  const entity = new SimpleDbEntityPrivacyChainXmrSent();
  (entity as { appStorage: unknown }).appStorage = memoryStorage({
    data: {
      accounts: Object.fromEntries(
        accountIds.map((id) => [id, { tx: { recipient: `4${id}` } }]),
      ),
    },
    updatedAt: 1,
  });
  return entity;
}

// A stored record holding scan data, as an enable leaves it.
function scanRecord(accountId: string, walletId = 'hd-1') {
  return {
    networkId,
    walletId,
    epoch: accountId
      .replace(/[^0-9]/g, '0')
      .padEnd(16, '0')
      .slice(0, 16),
    scan: { intent: 'on', birthday: { height: 100 } },
    createdAt: 1,
    updatedAt: 1,
  };
}

// The executor's in-memory fields on a service made without its constructor.
const lifecycleFields = () => ({
  backfillActiveByAccount: {},
  boostPausedByNetwork: {},
  syncFailureBackoff: new Map(),
  orphanCleanupGeneration: new Map<string, number>(),
  scheduleBackgroundSync: jest.fn(),
});

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
  const allIds = [liveAccountId, removedAccountId, hiddenAccountId];

  function createGcHarness(
    getAllAccounts: () => Promise<{
      accounts: { id: string; indexedAccountId?: string }[];
    }>,
    indexedAccountIds: string[] = allIds.map(
      (id) => accountRow(id).indexedAccountId,
    ),
    { wallets = [] as { id: string }[] } = {},
  ) {
    const deleteRuntimeAccount = jest.fn(async () => ({ orphaned: false }));
    const privacyChainKeys = createKeysDb(allIds);
    const removeLastBalances = jest.fn(async () => undefined);
    const privacyChainJournal = createJournalDb(allIds);
    const privacyChainXmrSent = createXmrSentDb(allIds);
    const privacyChainState = createPrivacyChainDb({
      data: {
        accounts: Object.fromEntries(allIds.map((id) => [id, scanRecord(id)])),
        // One wallet whose wallet is gone, one still live.
        wallets: { 'hd-gone': {}, 'hd-1': {} },
      },
      updatedAt: 1,
    });
    const listAccounts = jest.fn(async () => ({
      accounts: [],
      cleanupAccountIds: allIds,
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts,
        deleteRuntimeAccount,
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(getAllAccounts),
      getAllIndexedAccounts: jest.fn(async () => ({
        indexedAccounts: indexedAccountIds.map((id) => ({ id })),
      })),
      // A per-id read would report every one of these as missing.
      getDBAccountSafe: jest.fn(async () => undefined),
      getAccount: jest.fn(async () => {
        throw new OneKeyLocalError('account is gone');
      }),
      getAllWallets: jest.fn(async () => ({
        wallets: [{ id: 'hd-1' }, ...wallets],
      })),
    };
    const service = createService({
      ...lifecycleFields(),
      gcRunning: false,
      gcRequested: false,
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
          privacyChainXmrSent,
          privacyChainState,
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
    });
    return {
      service,
      serviceAccount,
      deleteRuntimeAccount,
      listAccounts,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainXmrSent,
      privacyChainState,
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
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainState,
      removeLastBalances,
    } = createGcHarness(async () => {
      throw new OneKeyLocalError('database is locked');
    });

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(removeLastBalances).not.toHaveBeenCalled();
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainState.listWalletStateIds()).resolves.toContain(
      'hd-gone',
    );
    expect(service.gcRunning).toBe(false);
  });

  it('purges an account that is definitely gone', async () => {
    const {
      service,
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainXmrSent,
      privacyChainState,
      removeLastBalances,
    } = createGcHarness(async () => ({
      accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
    }));

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeAccount).toHaveBeenCalledWith({
      accountId: removedAccountId,
    });
    // The account set changed: the runtime orphan cleanup is due again.
    expect(service.orphanCleanupGeneration.get(networkId)).toBe(1);
    const kept = [liveAccountId, hiddenAccountId];
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(kept);
    expect(removeLastBalances).toHaveBeenCalledWith({
      accountIds: [removedAccountId],
    });
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(kept);
    await expect(privacyChainXmrSent.listAccountIds()).resolves.toEqual(kept);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual(kept);
    // A wallet that is gone loses its facts once no record names it.
    await expect(privacyChainState.listWalletStateIds()).resolves.toEqual([
      'hd-1',
    ]);
  });

  // The key is what names the runtime data: a later pass needs it.
  it('keeps every record of an account whose runtime delete failed', async () => {
    const {
      service,
      deleteRuntimeAccount,
      privacyChainKeys,
      privacyChainJournal,
      privacyChainState,
    } = createGcHarness(async () => ({
      accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
    }));
    deleteRuntimeAccount.mockRejectedValueOnce(new Error('runtime busy'));

    await service.gcRemovedAccounts();

    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual(allIds);
    await expect(privacyChainJournal.listAccountIds()).resolves.toEqual(allIds);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual(allIds);
  });

  it('marks the network when a removed account names no runtime account', async () => {
    const { service, deleteRuntimeAccount, privacyChainState } =
      createGcHarness(async () => ({
        accounts: [accountRow(liveAccountId), accountRow(hiddenAccountId)],
      }));
    deleteRuntimeAccount.mockResolvedValueOnce({ orphaned: true });

    await service.gcRemovedAccounts();

    await expect(
      privacyChainState.hasRuntimeOrphans({ networkId }),
    ).resolves.toBe(true);
    await expect(
      privacyChainState.listAccountIds({ networkId }),
    ).resolves.toEqual([liveAccountId, hiddenAccountId]);
  });

  it('removes records no chain lists, unless a chain could not list', async () => {
    const strayId = 'hd-4--0';
    const harness = createGcHarness(async () => ({
      accounts: allIds.map(accountRow),
    }));
    await harness.privacyChainXmrSent.recordXmrSent({
      accountId: strayId,
      txid: 'tx',
      recipient: '4stray',
    });

    harness.listAccounts.mockRejectedValueOnce(new Error('cannot list'));
    await harness.service.gcRemovedAccounts();
    await expect(
      harness.privacyChainXmrSent.listAccountIds(),
    ).resolves.toContain(strayId);

    await harness.service.gcRemovedAccounts();
    await expect(
      harness.privacyChainXmrSent.listAccountIds(),
    ).resolves.not.toContain(strayId);
    expect(harness.deleteRuntimeAccount).not.toHaveBeenCalled();
  });

  it('keeps a hidden or locked passphrase wallet account', async () => {
    const { service, serviceAccount, deleteRuntimeAccount } = createGcHarness(
      async () => ({
        accounts: allIds.map(accountRow),
      }),
    );

    await service.gcRemovedAccounts();

    // Unfiltered: filterRemoved would drop locked passphrase wallets.
    expect(serviceAccount.getAllAccounts).toHaveBeenCalledWith();
    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(service.orphanCleanupGeneration.get(networkId)).toBeUndefined();
  });

  // Deleting an HD account removes its indexed account but leaves its rows.
  it('purges an account whose HD account was deleted', async () => {
    const { service, deleteRuntimeAccount, privacyChainKeys } = createGcHarness(
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

    expect(deleteRuntimeAccount).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeAccount).toHaveBeenCalledWith({
      accountId: removedAccountId,
    });
    await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
      liveAccountId,
      hiddenAccountId,
    ]);
  });

  it('keeps an imported account, which has no indexed account', async () => {
    const importedAccountId = 'imported--0';
    const { service, deleteRuntimeAccount } = createGcHarness(async () => ({
      accounts: [...allIds.map(accountRow), { id: importedAccountId }],
    }));
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({
          accounts: [],
          cleanupAccountIds: [importedAccountId],
        }),
        deleteRuntimeAccount,
      }),
    });

    await service.gcRemovedAccounts();

    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
  });

  function createEmptyGcHarness() {
    mockGetChainOnlyVault.mockResolvedValue({
      getLocalWalletCapability: () => ({
        listAccounts: async () => ({ accounts: [], cleanupAccountIds: [] }),
        deleteRuntimeAccount: jest.fn(),
      }),
    });
    const serviceAccount = {
      getAllAccounts: jest.fn(async () => ({ accounts: [] })),
      getAllIndexedAccounts: jest.fn(async () => ({ indexedAccounts: [] })),
      getAllWallets: jest.fn(async () => ({ wallets: [] })),
    };
    const privacyChainState = createPrivacyChainDb({
      data: { wallets: { 'hd-gone': {} } },
      updatedAt: 1,
    });
    const service = createService({
      ...lifecycleFields(),
      gcRunning: false,
      gcRequested: false,
      backgroundApi: {
        serviceAccount,
        simpleDb: {
          privacyChainKeys: createKeysDb([]),
          privacyChainCache: {
            listLastBalanceAccountIds: async () => [],
            removeLastBalances: jest.fn(),
          },
          privacyChainJournal: createJournalDb(),
          privacyChainXmrSent: createXmrSentDb(),
          privacyChainState,
        },
      },
      getLocalWalletNetworkIds: async () => [networkId],
    });
    return { service, serviceAccount, privacyChainState };
  }

  it('reads no accounts when there is nothing to purge', async () => {
    const { service, serviceAccount, privacyChainState } =
      createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(serviceAccount.getAllIndexedAccounts).not.toHaveBeenCalled();
    await expect(privacyChainState.listWalletStateIds()).resolves.toEqual([]);
  });

  it('keeps wallet state while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, serviceAccount } = createEmptyGcHarness();

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllWallets).not.toHaveBeenCalled();
  });

  it('purges nothing while Travel Mode masks the database', async () => {
    jest.spyOn(travelModeManager, 'getRuntimeEnvironment').mockResolvedValue({
      persistence: { kind: 'masked' },
    } as unknown as IRuntimeEnvironment);
    const { service, serviceAccount, deleteRuntimeAccount } = createGcHarness(
      async () => ({ accounts: [] }),
    );

    await service.gcRemovedAccounts();

    expect(serviceAccount.getAllAccounts).not.toHaveBeenCalled();
    expect(deleteRuntimeAccount).not.toHaveBeenCalled();
    expect(serviceAccount.getAllWallets).not.toHaveBeenCalled();
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
      ...lifecycleFields(),
      backgroundApi: {
        simpleDb: {
          privacyChainState: privacyChain,
          privacyChainKeys: createKeysDb([]),
          privacyChainJournal: createJournalDb(),
          privacyChainXmrSent: createXmrSentDb(),
          privacyChainCache: {
            removeLastBalances: jest.fn(async () => undefined),
            removeNetworkLastBalances: jest.fn(async () => undefined),
            removeChainTips: jest.fn(async () => undefined),
          },
        },
      },
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
    await privacyChain.markRuntimeOrphans({ networkId });

    await service.retryPendingLocalDataDrop();

    expect(dropLocalData).toHaveBeenCalledTimes(1);
    await expect(privacyChain.getPendingLocalDataDrop()).resolves.toEqual([]);
    // Nothing is left in a dropped database to be an orphan.
    await expect(privacyChain.hasRuntimeOrphans({ networkId })).resolves.toBe(
      false,
    );
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
    function createDeleteHarness(initial: {
      enabled: boolean;
      pendingOperation?: 'enable' | 'disable';
    }) {
      const calls: string[] = [];
      let state = { ...initial };
      const capability = {
        getAccountState: jest.fn(async () => state),
        disableAccount: jest.fn(async () => {
          calls.push('disable');
          state = { enabled: false };
        }),
        deleteRuntimeAccount: jest.fn(async () => {
          calls.push('delete');
          return { orphaned: false };
        }),
        clearPendingSends: jest.fn(
          async ({ scope }: { scope: 'pending' | 'expired' }) => {
            calls.push(`clearPending:${scope}`);
          },
        ),
      };
      mockGetVaultSettings.mockResolvedValue({ localWallet: {} });
      const privacyChainKeys = createKeysDb([liveAccountId, hiddenAccountId]);
      const privacyChainState = createPrivacyChainDb();
      const forgetCachedLocalWalletBalance = jest.fn(async () => undefined);
      const service = createService({
        ...lifecycleFields(),
        backgroundApi: {
          simpleDb: {
            privacyChainKeys,
            privacyChainState,
            privacyChainXmrSent: createXmrSentDb([liveAccountId]),
            privacyChainCache: {
              removeLastBalances: jest.fn(async () => undefined),
            },
          },
        },
        enableMutexByNetwork: new Map<string, Mutex>(),
        requireAccountCapability: async () => capability,
        forgetCachedLocalWalletBalance,
      });
      return {
        service,
        capability,
        calls,
        privacyChainKeys,
        privacyChainState,
        forgetCachedLocalWalletBalance,
        setState: (next: typeof state) => {
          state = next;
        },
      };
    }

    it('turns an enabled account off before deleting', async () => {
      const { service, calls, forgetCachedLocalWalletBalance } =
        createDeleteHarness({ enabled: true });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });

      // Only sends that can no longer be mined go with the data.
      expect(calls).toEqual(['disable', 'delete', 'clearPending:expired']);
      // The account set changed: the runtime orphan cleanup is due again.
      expect(service.orphanCleanupGeneration.get(chainNetworkId)).toBe(1);
      expect(forgetCachedLocalWalletBalance).toHaveBeenCalledWith({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });
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

      expect(calls).toEqual(['disable', 'delete', 'clearPending:expired']);
    });

    it('refuses to delete an account still on after the disable', async () => {
      const { service, capability } = createDeleteHarness({ enabled: true });
      capability.disableAccount.mockImplementationOnce(async () => undefined);

      await expect(
        service.deleteLocalWalletAccountData({
          networkId: chainNetworkId,
          accountId: liveAccountId,
        }),
      ).rejects.toThrow('turn scanning off before deleting local data');
      expect(capability.deleteRuntimeAccount).not.toHaveBeenCalled();
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
      expect(calls).toEqual(['delete', 'clearPending:expired']);
      // The viewing key goes with the data on both chains; others stay.
      await expect(privacyChainKeys.listAccountIds()).resolves.toEqual([
        hiddenAccountId,
      ]);
    });

    it('marks the network when the runtime account could not be named', async () => {
      const { service, capability, privacyChainState } = createDeleteHarness({
        enabled: false,
      });
      capability.deleteRuntimeAccount.mockResolvedValueOnce({ orphaned: true });

      await service.deleteLocalWalletAccountData({
        networkId: chainNetworkId,
        accountId: liveAccountId,
      });

      await expect(
        privacyChainState.hasRuntimeOrphans({ networkId: chainNetworkId }),
      ).resolves.toBe(true);
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
      expect(capability.deleteRuntimeAccount).not.toHaveBeenCalled();
    });

    it('keeps the viewing key when deleting the data fails', async () => {
      const { service, capability, privacyChainKeys } = createDeleteHarness({
        enabled: false,
      });
      capability.deleteRuntimeAccount.mockRejectedValueOnce(
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
      expect(calls).toEqual(['delete', 'clearPending:expired']);
    });
  },
);
